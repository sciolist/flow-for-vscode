/* @flow */

/*
 Copyright (c) 2015-present, Facebook, Inc.
 All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 the root directory of this source tree.
 */

import * as vscode from 'vscode';
import * as path from 'path';

import * as FlowService from '../nuclide-built/nuclide-flow-base/lib/FlowService';

let lastDiagnostics: vscode.DiagnosticCollection = null;

export function setup(disposables: Array<Function>): void {
	
	// Do an initial call to get diagnostics from the active editor if any
	if (vscode.window.activeTextEditor) {
		updateDiagnostics(vscode.window.activeTextEditor.document);
	}
	
	// Update diagnostics: when active text editor changes
	disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		updateDiagnostics(editor && editor.document);
	}));
	
	// Update diagnostics when document is edited
	disposables.push(vscode.workspace.onDidSaveTextDocument(event => {
		if (vscode.window.activeTextEditor) {
			updateDiagnostics(vscode.window.activeTextEditor.document);
		}
	}));
}

function updateDiagnostics(document): void {
	getDiagnostics(document).then((diag) => applyDiagnostics(diag)).catch((error) => console.error(error.toString()));
}

async function getDiagnostics(document) {
	let diags = Object.create(null);
	
	if (!document) {
		return diags; // we need a document
	}
	
	const filePath = document.uri.fsPath;
	if (path.extname(filePath) !== '.js') {
		return diags; // we only check on JS files
	}
	
	// flowFindDiagnostics takes the provided filePath and then walks up directories
	// until a .flowconfig is found. The diagnostics are then valid for the entire
	// flow workspace. 
	let rawDiag = await FlowService.flowFindDiagnostics(filePath);
	if (rawDiag && rawDiag.messages) {
		rawDiag.messages.forEach((messageInfo) => {
			// Errors and Warnings in flow can have multiple positions in the editor with multiple
			// messages. We currently do not support this and instead just flatten all reported issues
			// into one (see details below)
			let addedInFiles = {};
			var message = messageInfo.messageComponents;
			var fullMessage = message[0].descr;
			var subMessage = message.slice(1).map(part => {
				if ('descr' in part) return part.descr;
			}).filter(m => m !== undefined).join(' ');
			if (subMessage.length) fullMessage += ' (' + subMessage + ')';

			message.forEach(function (m) {
				if (!m.range || m.range.file in addedInFiles) return;
				addedInFiles[m.range.file] = true;
				let diag: any = Object.create(null);
				let file = m.range.file;
				diag.startLine = m.range.start.line;
				diag.endLine = m.range.end.line;
				diag.severity = messageInfo.level;
				diag.startCol = m.range.start.column;
				diag.endCol = m.range.end.column;

				var seenFiles = {};
				var otherFiles = message.map(m => {
					if (!m.range || !m.range.file || m.range.file === file || m.range.file in seenFiles) return;
					seenFiles[m.range.file] = true;
					return m.range.file + " (line: " + m.range.start.line + ")"
				}).filter(m => m).join('\n');

				diag.msg = fullMessage + (otherFiles.length > 0 ? '\n\nSee also:\n' + otherFiles : '');

				if (!diags[file]) {
					diags[file] = [];
				}

				diags[file].push(diag);
			});
		});
	}

	return diags;
}

function mapSeverity(sev: string) {
	switch (sev) {
		case "error": return vscode.DiagnosticSeverity.Error;
		case "warning": return vscode.DiagnosticSeverity.Warning;
		default: return vscode.DiagnosticSeverity.Error;
	}
}

function applyDiagnostics(diagnostics) {
	if (lastDiagnostics) {
		lastDiagnostics.dispose(); // clear old collection
	}
	
	// create new collection
	lastDiagnostics = vscode.languages.createDiagnosticCollection();
	for (let file in diagnostics) {
		let errors = diagnostics[file];
		var targetResource = vscode.Uri.file(file);

		let diags = errors.map(error => {
			let range = new vscode.Range(error.startLine - 1, error.startCol - 1, error.endLine - 1, error.endCol);
			let location = new vscode.Location(targetResource, range);
			
			return new vscode.Diagnostic(range, error.msg, mapSeverity(error.severity));
		})

		lastDiagnostics.set(targetResource, diags);
	}
}
