/* @flow */

/*
 Copyright (c) 2015-present, Facebook, Inc.
 All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 the root directory of this source tree.
 */

import * as vscode from 'vscode';

import * as FlowService from '../nuclide-built/nuclide-flow-base/lib/FlowService';

export class CompletionSupport {
	triggerCharacters: Array<string>;
	constructor() {
		this.triggerCharacters = ['.'];
	}

	async provideCompletionItems(document, position, token) {
		const fileName = document.uri.fsPath;
		const currentContents = document.getText();
		const line = position.line;
		const col = position.character;
		const prefix = '.'; // TODO do better.
		const completions = await FlowService.flowGetAutocompleteSuggestions(
			fileName,
			currentContents,
			line,
			col,
			prefix,
			true,
		);
		
		if (completions) {
			return completions.map(atomCompletion => {
				const completion = new vscode.CompletionItem(atomCompletion.displayText);
				if (atomCompletion.description) {
					completion.detail = atomCompletion.description;
				}
				completion.kind = this.typeToKind(atomCompletion.type, atomCompletion.description);

				if (completion.kind === vscode.CompletionItemKind.Function) {
					completion.insertText = atomCompletion.snippet.replace(/\${\d+:/g, '{{').replace(/}/g, '}}') + '{{}}';
				}
				
				return completion;
			});
		}
		
		return [];
	}
	
	typeToKind(type: string, description: string): number {
		// Possible Kinds in VS Code:
		// Method,
		// Function,
		// Constructor,
		// Field,
		// Variable,
		// Class,
		// Interface,
		// Module,
		// Property
		if (type === 'function') {
			return vscode.CompletionItemKind.Function;
		}
		
		if (description && description.indexOf('[class: ') >= 0) {
			return vscode.CompletionItemKind.Class;
		}
		
		return vscode.CompletionItemKind.Variable;
	}
}
