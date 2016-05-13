#!/bin/bash

# This is a horrible hack that is necessary because Nuclide doesn't transpile
# FlowService.js since it serves as an RPC definition file. We should figure out
# a long-term solution but for now, this works.
[ -d ./nuclide-built ] || (
    cd nuclide/
    cp ../.babelrc .
    babel -D pkg/nuclide-flow-base --out-dir ../nuclide-built/nuclide-flow-base
    babel -D pkg/nuclide-commons --out-dir ../nuclide-built/nuclide-commons
    babel -D pkg/nuclide-tokenized-text --out-dir ../nuclide-built/nuclide-tokenized-text
    babel -D pkg/nuclide-logging --out-dir ../nuclide-built/nuclide-logging
    babel -D pkg/nuclide-analytics --out-dir ../nuclide-built/nuclide-analytics
)

echo "Transpiling ./lib"
babel ./lib --out-dir=./build --source-maps $@
