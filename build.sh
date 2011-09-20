#!/bin/sh

DIR_BASE=$(cd $(dirname $0); pwd)
DIR_EXPORTER=$DIR_BASE/stub/module-exporter
DIR_ORGJS=$DIR_BASE/src/org-js

$DIR_EXPORTER/export.rb $DIR_ORGJS/*.js > ./org.js
