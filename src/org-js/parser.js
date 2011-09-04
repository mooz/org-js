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

  skipBlank: function () {
    var blankToken = null;
    while (this.lexer.peekNextToken().type === Lexer.tokens.blank)
      blankToken = this.lexer.getNextToken();
    return blankToken;
  },

  // ------------------------------------------------------------
  // <Document> ::= <Element>*
  // ------------------------------------------------------------

  parseDocument: function () {
    while (this.lexer.hasNext()) {
      var element = this.parseElement();
      if (element) this.document.push(element);
    }
  },

  // ------------------------------------------------------------
  // <Element> ::= (<Header> | <List>
  //              | <Preformatted> | <Paragraph>
  //              | <Table>)*
  // ------------------------------------------------------------

  parseElement: function () {
    var token = null;

    switch (this.lexer.peekNextToken().type) {
    case Lexer.tokens.header:
      token = this.parseHeader();
      break;
    case Lexer.tokens.preformatted:
      token = this.parsePreformatted();
      break;
    case Lexer.tokens.orderedListElement:
    case Lexer.tokens.unorderedListElement:
      token = this.parseList();
      break;
    case Lexer.tokens.line:
      token = this.parseText();
      break;
    case Lexer.tokens.blank:
      this.skipBlank();
      if (this.lexer.hasNext()) {
        if (this.lexer.peekNextToken().type === Lexer.tokens.line)
          token = this.parseParagraph();
        else
          token = this.parseElement();
      }
      break;
    }

    return token;
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
      var blankToken = this.skipBlank();
      if (!this.lexer.hasNext())
        break;

      var notBlankNextToken = this.lexer.peekNextToken();
      if (blankToken && !notBlankNextToken.isListElement())
        this.lexer.pushToken(blankToken); // Recover blank token only when next line is not listElement.
      if (notBlankNextToken.indentation === 0)
        break;                  // end of the list

      var element = this.parseElement(); // recursive
      if (element)
        listElement.children.push(element);
    }

    return listElement;
  },

  // ------------------------------------------------------------
  // <Paragraph> ::= <Blank> <Line>*
  // ------------------------------------------------------------

  parseParagraph: function () {
    var paragraphFisrtToken = this.lexer.peekNextToken();
    assert.ok(paragraphFisrtToken.type === Lexer.tokens.line);
    var paragraph = Node.createParagraph([]);

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.type !== Lexer.tokens.line
          || nextToken.indentation < paragraphFisrtToken.indentation)
        break;
      this.lexer.getNextToken();
      paragraph.children.push(this.createTextNode(nextToken.content));
    }

    return paragraph;
  },

  parseText: function () {
    var lineToken = this.lexer.getNextToken();
    assert.ok(lineToken.type === Lexer.tokens.line);
    return this.createTextNode(lineToken.content);
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
