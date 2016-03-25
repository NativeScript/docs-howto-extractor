#!/usr/bin/env bash

nsdir=../nativescript/
./node_modules/typescript/bin/tsc app.ts ./Scripts/typings/node/node.d.ts --target ES5

(cd $nsdir && grunt --leavecomments=true)
(cd $nsdir && node ../docs-howto-extractor/app.js -noclean -source ./bin/dist/apps/tests -destination ../docs-howto-extractor/__GENERATED_APIREF__/)

