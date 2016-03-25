#!/usr/bin/env bash

nsdir=../nativescript/
./node_modules/typescript/bin/tsc app.ts ./Scripts/typings/node/node.d.ts --target ES5

(cd $nsdir && grunt --leavecomments=true)
node app.js -noclean -source ../nativescript/bin/dist/apps/tests -destination ./__GENERATED_APIREF__/

