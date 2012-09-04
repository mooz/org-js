#!/usr/bin/env node

try {
  var org = require("org-js");
} catch (x) {
  org = require("./");
}
var parser = new org.Parser();

process.stdin.resume();
process.stdin.setEncoding('utf8');

var orgCode = "";
process.stdin.on('data', function (chunk) {
  orgCode += chunk;
});

process.stdin.on('end', function () {
  parseAndOutputHTML();
});

function parseAndOutputHTML() {
  var orgDocument = parser.parse(orgCode);
  orgDocument.options.num = false;
  orgDocument.options.toc = false;
  var exportOptions = {};
  var redmineNotation = org.RedmineConverter.convertDocument(orgDocument, exportOptions);
  console.log(redmineNotation);
}
