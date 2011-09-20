#!/bin/sh

DIR_EDITOR=$(cd $(dirname $0); pwd)
DIR_EXPORTER=$DIR_EDITOR/../module-exporter
DIR_ORGJS=$DIR_EDITOR/../../src/org-js

cd $DIR_EXPORTER

./export.rb ../../src/org-js/*.js > ../editor/org.js && \
    echo "\nvar assert = { ok: function () {} };" >> ../editor/org.js
