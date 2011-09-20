var Stream = require("./stream.js").Stream;
var Lexer  = require("./lexer.js").Lexer;
var Node   = require("./node.js").Node;
var assert = require("assert");

function Parser() {
  this.inlineParser = new InlineParser();
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
    var element = null;

    switch (this.lexer.peekNextToken().type) {
    case Lexer.tokens.header:
      element = this.parseHeader();
      break;
    case Lexer.tokens.preformatted:
      element = this.parsePreformatted();
      break;
    case Lexer.tokens.orderedListElement:
    case Lexer.tokens.unorderedListElement:
      element = this.parseList();
      break;
    case Lexer.tokens.line:
      element = this.parseText();
      break;
    case Lexer.tokens.tableRow:
    case Lexer.tokens.tableSeparator:
      element = this.parseTable();
      break;
    case Lexer.tokens.blank:
      this.skipBlank();
      if (this.lexer.hasNext()) {
        if (this.lexer.peekNextToken().type === Lexer.tokens.line)
          element = this.parseParagraph();
        else
          element = this.parseElement();
      }
      break;
    case Lexer.tokens.comment:
      // Skip
      this.lexer.getNextToken();
      break;
    default:
      throw new Error("Unhandled token: " + this.lexer.peekNextToken().type);
    }

    return element;
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

    var textContents = [];

    while (this.lexer.hasNext()) {
      var token = this.lexer.peekNextToken();
      if (token.type !== Lexer.tokens.preformatted ||
          token.indentation < preformattedFirstToken.indentation)
        break;
      this.lexer.getNextToken();
      textContents.push(token.content);
    }

    preformatted.children.push(this.createTextNode(textContents.join("\n")));

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
      if (notBlankNextToken.indentation <= rootIndentation)
        break;                  // end of the list

      var element = this.parseElement(); // recursive
      if (element)
        listElement.children.push(element);
    }

    return listElement;
  },

  // ------------------------------------------------------------
  // <Table> ::= <TableRow>+
  // ------------------------------------------------------------

  parseTable: function () {
    var table = Node.createTable([]);
    var nextToken;
    var sawSeparator = false;

    while (this.lexer.hasNext() &&
           (nextToken = this.lexer.peekNextToken()).isTableElement()) {
      if (nextToken.type === Lexer.tokens.tableRow) {
        var tableRow = this.parseTableRow();
        table.children.push(tableRow);
      } else {
        sawSeparator = true;
        this.lexer.getNextToken();
      }
    }

    if (sawSeparator && table.children.length) {
      table.children[0].children.forEach(function (cell) {
        cell.isHeader = true;
      });
    }

    return table;
  },

  // ------------------------------------------------------------
  // <TableRow> ::= <TableCell>+
  // ------------------------------------------------------------

  parseTableRow: function () {
    var tableRowToken = this.lexer.getNextToken();

    // XXX: Low performance
    return Node.createTableRow(
      tableRowToken.content
        .split("|")
        .map(function (text) {
          return Node.createTableCell([
            this.createTextNode(text)
          ]);
        }, this)
    );
  },

  // ------------------------------------------------------------
  // <Paragraph> ::= <Blank> <Line>*
  // ------------------------------------------------------------

  parseParagraph: function () {
    var paragraphFisrtToken = this.lexer.peekNextToken();
    assert.ok(paragraphFisrtToken.type === Lexer.tokens.line);
    var paragraph = Node.createParagraph([]);

    var textContents = [];

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.type !== Lexer.tokens.line
          || nextToken.indentation < paragraphFisrtToken.indentation)
        break;
      this.lexer.getNextToken();
      textContents.push(nextToken.content);
    }

    paragraph.children.push(this.createTextNode(textContents.join("\n")));

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
    return this.inlineParser.parseEmphasis(text);
  }
};

// ------------------------------------------------------------
// Parser for Inline Elements
//
// @refs org-emphasis-regexp-components
// ------------------------------------------------------------

function InlineParser() {
  this.preEmphasis     = " \t\\('\"";
  this.postEmphasis    = "- \t.,:!?;'\"\\)";
  this.borderForbidden = " \t\r\n,\"'";
  this.bodyRegexp      = "[\\s\\S]*?";
  this.markers         = "*/_=~+";

  this.imageExtensions = [
    "bmp", "png", "jpeg", "jpg", "gif", "tiff",
    "tif", "xbm", "xpm", "pbm", "pgm", "ppm"
  ].join("|");

  this.emphasisPattern = this.buildEmphasisPattern();
  this.linkPattern = /\[\[([^\]]*)\](?:\[([^\]]*)\])?\]/g; // \1 => link, \2 => text
}

InlineParser.prototype = {
  parseEmphasis: function (text) {
    var emphasisPattern = this.emphasisPattern;
    emphasisPattern.lastIndex = 0;

    var result = [],
        match,
        previousLast = 0,
        savedLastIndex;

    while ((match = emphasisPattern.exec(text))) {
      var whole  = match[0];
      var pre    = match[1];
      var marker = match[2];
      var body   = match[3];
      var post   = match[4];

      {
        // parse links
        var matchBegin = emphasisPattern.lastIndex - whole.length;
        var beforeContent = text.substring(previousLast, matchBegin + pre.length);
        savedLastIndex = emphasisPattern.lastIndex;
        result.push(this.parseLink(beforeContent));
        emphasisPattern.lastIndex = savedLastIndex;
      }

      var bodyNode = [Node.createText(null, { value: body })];
      var bodyContainer = this.emphasizeElementByMarker(bodyNode, marker);
      result.push(bodyContainer);

      previousLast = emphasisPattern.lastIndex - post.length;
    }

    if (emphasisPattern.lastIndex === 0 ||
        emphasisPattern.lastIndex !== text.length - 1)
      result.push(this.parseLink(text.substring(previousLast)));

    return Node.createInlineContainer(result);
  },

  depth: 0,
  parseLink: function (text) {
    var linkPattern = this.linkPattern;
    linkPattern.lastIndex = 0;

    var match,
        result = [],
        previousLast = 0,
        savedLastIndex;

    while ((match = linkPattern.exec(text))) {
      var whole = match[0];
      var src   = match[1];
      var title = match[2];

      // parse before content
      var matchBegin = linkPattern.lastIndex - whole.length;
      var beforeContent = text.substring(previousLast, matchBegin);
      result.push(Node.createText(null, { value: beforeContent }));

      // parse link
      var link = Node.createLink([]);
      link.src = src;
      if (title) {
        savedLastIndex = linkPattern.lastIndex;
        link.children.push(this.parseEmphasis(title));
        linkPattern.lastIndex = savedLastIndex;
      } else {
        link.children.push(Node.createText(null, { value: src }));
      }
      result.push(link);

      previousLast = linkPattern.lastIndex;
    }

    if (linkPattern.lastIndex === 0 ||
        linkPattern.lastIndex !== text.length - 1)
      result.push(Node.createText(null, { value: text.substring(previousLast) }));

    return Node.createInlineContainer(result);
  },

  emphasizeElementByMarker: function (element, marker) {
    switch (marker) {
    case "*":
      return Node.createBold(element);
    case "/":
      return Node.createItalic(element);
    case "_":
      return Node.createUnderline(element);
    case "=":
    case "~":
      return Node.createCode(element);
    case "+":
      return Node.createDashed(element);
    }
  },

  buildEmphasisPattern: function () {
    return new RegExp(
      "([" + this.preEmphasis + "]|^)" +                     // \1 => pre
        "([" + this.markers + "])" +                         // \2 => marker
        "([^" + this.borderForbidden + "]|" +                // \3 => body
        "[^" + this.borderForbidden + "]" +
        this.bodyRegexp +
        "[^" + this.borderForbidden + "])" +
        "\\2" +
        "([" + this.postEmphasis +"]|$)",                    // \4 => post
        // flags
        "g"
    );
  }
};

if (typeof exports !== "undefined") {
  exports.Parser = Parser;
  exports.InlineParser = InlineParser;
}
