var Stream = require("./stream.js").Stream;
var Lexer  = require("./lexer.js").Lexer;
var Node   = require("./node.js").Node;
var assert = require("assert");

function Parser() {
}

Parser.prototype = {
  initStatus: function (stream) {
    if (typeof stream === "string")
      stream = new Stream(stream);
    this.lexer = new Lexer(stream);
    this.document = [];
  },

  parse: function (stream) {
    this.initStatus(stream);
    this.parseDocument();
    return this.document;
  },

  // ------------------------------------------------------------
  // <Document> ::= <Element>*
  // ------------------------------------------------------------

  parseDocument: function () {
    var element;
    while (this.lexer.hasNext()) {
      element = this.parseElement(0);
      if (element) { this.document.push(element); }
    }
  },

  // ------------------------------------------------------------
  // <Element> ::= (<Header> | <List>
  //              | <Preformatted> | <Paragraph>
  //              | <Table>)*
  // ------------------------------------------------------------

  parseElement: function () {
    switch (this.lexer.peekNextToken().type) {
    case Lexer.tokens.header:
      return this.parseHeader();
    case Lexer.tokens.preformatted:
      return this.parsePreformatted();
    case Lexer.tokens.orderedListElement:
    case Lexer.tokens.unorderedListElement:
      return this.parseList();
    case Lexer.tokens.paragraph:
      return this.parseParagraph();
    case Lexer.tokens.blank:
      this.lexer.getNextToken();
      return this.parseElement(); // loop
    }

    throw new Error("SyntaxError: Unknown Line");
  },

  // ------------------------------------------------------------
  // <Header>
  //
  // : preformatted
  // : block
  // ------------------------------------------------------------

  parseHeader: function () {
    var headerToken = this.lexer.getNextToken();
    assert.ok(headerToken.indentation === 0);

    var header = Node.createHeader([
      this.createTextNode(headerToken.content) // TODO: Parse inline markups
    ], { level: headerToken.level });

    return header;
  },

  // ------------------------------------------------------------
  // <Preformatted>
  //
  // : preformatted
  // : block
  // ------------------------------------------------------------

  parsePreformatted: function () {
    var preformattedFirstToken = this.lexer.peekNextToken();
    assert.ok(preformattedFirstToken.type === Lexer.tokens.preformatted);
    var preformatted = Node.createPreformatted([]);

    while (this.lexer.hasNext()) {
      var token = this.lexer.peekNextToken();
      if (token.type !== Lexer.tokens.preformatted ||
          token.indentation < preformattedFirstToken.indentation)
        break;
      this.lexer.getNextToken();
      preformatted.children.push(this.createTextNode(token.content));
    }

    return preformatted;
  },

  // ------------------------------------------------------------
  // <List>
  //
  //  - foo
  //    1. bar
  //    2. baz
  // ------------------------------------------------------------

  parseList: function () {
    var rootToken = this.lexer.peekNextToken();
    var list = rootToken.type === Lexer.tokens.unorderedListElement ?
      Node.createUnorderedList([]) : Node.createOrderedList([]);

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (!nextToken.isListElement() || nextToken.indentation !== rootToken.indentation)
        break;
      list.children.push(this.parseListElement(rootToken.indentation));
    }

    return list;
  },

  parseListElement: function (rootIndentation) {
    var listElementToken = this.lexer.getNextToken();
    assert.ok(listElementToken.isListElement());
    var listElement = Node.createListElement([
      this.createTextNode(listElementToken.content)
    ]);

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.indentation <= rootIndentation && nextToken.type !== "blank")
        break;
      listElement.children.push(this.parseElement()); // recursive
    }

    return listElement;
  },

  // ------------------------------------------------------------
  // <Paragraph>
  // ------------------------------------------------------------

  parseParagraph: function () {
    var paragraphFisrtToken = this.lexer.peekNextToken();
    assert.ok(paragraphFisrtToken.type === Lexer.tokens.paragraph);
    var paragraph = Node.createParagraph([]);

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.type !== Lexer.tokens.paragraph
          || nextToken.indentation < paragraphFisrtToken.indentation)
        break;
      this.lexer.getNextToken();
      paragraph.children.push(this.createTextNode(nextToken.content));
    }

    return paragraph;
  },

  // ------------------------------------------------------------
  // <Text> (DOM Like)
  // ------------------------------------------------------------

  createTextNode: function (text) {
    return Node.createText(null, { value: text });
  }
};

if (typeof exports !== "undefined")
  exports.Parser = Parser;
