var assert = require("assert");

require.paths.push("../src/org-js/");
var Parser            = require("parser.js").Parser;
var Node              = require("node.js").Node;
var HtmlTextConverter = require("converter-html.js").HtmlTextConverter;

module.exports = {
  "test foo": function () {
    var parser = new Parser();

    var doc = parser.parse([
      ": hogehoge",
      ": hugahuga",
      "This is a paragraph,",
      "desu.",
      "",
      "2nd Paragraph",
      "",
      "- foo",
      " - bar :: hoge",
      "- baz"
    ].join("\n"));

    console.log(HtmlTextConverter.convertNodes(doc.nodes));
    console.dir(doc);
    console.log(JSON.stringify(doc, null, 1));
  }
};
