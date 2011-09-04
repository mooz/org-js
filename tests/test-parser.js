var assert = require("assert");

require.paths.push("../src/org-js/");
var Parser        = require("parser.js").Parser;
var Node          = require("node.js").Node;
var HtmlConverter = require("converter-html.js").HtmlConverter;

module.exports = {
  "test header": function () {
    var parser = new Parser();

    assert.eql(parser.parse("* hogehoge"), [
      Node.createHeader([
        Node.createText(null, { value: "hogehoge" })
      ], { level: 1 })
    ]);
  },

  "test header3": function () {
    var parser = new Parser();

    assert.eql(parser.parse("*** hogehoge"), [
      Node.createHeader([
        Node.createText(null, { value: "hogehoge" })
      ], { level: 3 })
    ]);
  },

  "test header15": function () {
    var parser = new Parser();

    assert.eql(parser.parse("*************** hogehoge"), [
      Node.createHeader([
        Node.createText(null, { value: "hogehoge" })
      ], { level: 15 })
    ]);
  },

  "test pre": function () {
    var parser = new Parser();

    assert.eql(parser.parse(": hogehoge"), [
      Node.createPreformatted([
        Node.createText(null, { value: "hogehoge" })
      ])
    ]);
  },

  "test foo": function () {
    var parser = new Parser();

    var parsed = parser.parse([
      ": hogehoge",
      ": hugahuga",
      "This is a paragraph,",
      "desu.",
      "",
      "2nd Paragraph",
      "",
      "- foo",
      " - bar",
      "- baz"
    ].join("\n"));

    console.log(HtmlConverter.convertNodes(parsed));
    console.dir(parsed);
    console.log(JSON.stringify(parsed, null, 1));
  }
};
