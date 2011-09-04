#!/usr/bin/env node

require.paths.push("./src/org-js/");

var Parser        = require("parser.js").Parser;
var HtmlConverter = require("converter-html.js").HtmlConverter;

var stdin = process.openStdin();
var input = '';

stdin.setEncoding('utf8');
stdin.on('data', function (data) {
  if (data)
    input += data;
});

stdin.on('end', function () {
  if (!input)
    return;
  var parser = new Parser();
  var nodes  = parser.parse(input);
  var htmlString = HtmlConverter.convertNodes(nodes);
  console.log(htmlString);
});
