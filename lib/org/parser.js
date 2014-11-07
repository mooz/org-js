var Stream = require("./stream.js").Stream;
var Lexer  = require("./lexer.js").Lexer;
var Node   = require("./node.js").Node;

function Parser() {
  this.inlineParser = new InlineParser();
}

Parser.parseStream = function (stream, options) {
  var parser = new Parser();
  parser.initStatus(stream, options);
  parser.parseNodes();
  return parser.nodes;
};

Parser.prototype = {
  initStatus: function (stream, options) {
    if (typeof stream === "string")
      stream = new Stream(stream);
    this.lexer = new Lexer(stream);
    this.nodes = [];
    this.options = {
      toc: true,
      num: true,
      "^": "{}",
      multilineCell: false
    };
    // Override option values
    if (options && typeof options === "object") {
      for (var key in options) {
        this.options[key] = options[key];
      }
    }
    this.document = {
      options: this.options,
      directiveValues: {},
      convert: function (ConverterClass, exportOptions) {
        var converter = new ConverterClass(this, exportOptions);
        return converter.result;
      }
    };
  },

  parse: function (stream, options) {
    this.initStatus(stream, options);
    this.parseDocument();
    this.document.nodes = this.nodes;
    return this.document;
  },

  createErrorReport: function (message) {
    return new Error(message + " at line " + this.lexer.getLineNumber());
  },

  skipBlank: function () {
    var blankToken = null;
    while (this.lexer.peekNextToken().type === Lexer.tokens.blank)
      blankToken = this.lexer.getNextToken();
    return blankToken;
  },

  setNodeOriginFromToken: function (node, token) {
    node.fromLineNumber = token.fromLineNumber;
    return node;
  },

  appendNode: function (newNode) {
    var previousSibling = this.nodes.length > 0 ? this.nodes[this.nodes.length - 1] : null;
    this.nodes.push(newNode);
    newNode.previousSibling = previousSibling;
  },

  // ------------------------------------------------------------
  // <Document> ::= <Element>*
  // ------------------------------------------------------------

  parseDocument: function () {
    this.parseTitle();
    this.parseNodes();
  },

  parseNodes: function () {
    while (this.lexer.hasNext()) {
      var element = this.parseElement();
      if (element) this.appendNode(element);
    }
  },

  parseTitle: function () {
    this.skipBlank();

    if (this.lexer.hasNext() &&
        this.lexer.peekNextToken().type === Lexer.tokens.line)
      this.document.title = this.createTextNode(this.lexer.getNextToken().content);
    else
      this.document.title = null;

    this.lexer.pushDummyTokenByType(Lexer.tokens.blank);
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
    case Lexer.tokens.horizontalRule:
      this.lexer.getNextToken();
      element = Node.createHorizontalRule();
      break;
    case Lexer.tokens.directive:
      element = this.parseDirective();
      break;
    case Lexer.tokens.comment:
      // Skip
      this.lexer.getNextToken();
      break;
    default:
      throw this.createErrorReport("Unhandled token: " + this.lexer.peekNextToken().type);
    }

    return element;
  },

  parseElementBesidesDirectiveEnd: function () {
    try {
      // Temporary, override the definition of `parseElement`
      this.parseElement = this.parseElementBesidesDirectiveEndBody;
      return this.parseElement();
    } finally {
      this.parseElement = this.originalParseElement;
    }
  },

  parseElementBesidesDirectiveEndBody: function () {
    if (this.lexer.peekNextToken().type === Lexer.tokens.directive &&
        this.lexer.peekNextToken().endDirective) {
      return null;
    }

    return this.originalParseElement();
  },

  // ------------------------------------------------------------
  // <Header>
  //
  // : preformatted
  // : block
  // ------------------------------------------------------------

  parseHeader: function () {
    var headerToken = this.lexer.getNextToken();
    var header = Node.createHeader([
      this.createTextNode(headerToken.content) // TODO: Parse inline markups
    ], { level: headerToken.level });
    this.setNodeOriginFromToken(header, headerToken);

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
    var preformatted = Node.createPreformatted([]);
    this.setNodeOriginFromToken(preformatted, preformattedFirstToken);

    var textContents = [];

    while (this.lexer.hasNext()) {
      var token = this.lexer.peekNextToken();
      if (token.type !== Lexer.tokens.preformatted ||
          token.indentation < preformattedFirstToken.indentation)
        break;
      this.lexer.getNextToken();
      textContents.push(token.content);
    }

    preformatted.appendChild(this.createTextNode(textContents.join("\n"), true /* no emphasis */));

    return preformatted;
  },

  // ------------------------------------------------------------
  // <List>
  //
  //  - foo
  //    1. bar
  //    2. baz
  // ------------------------------------------------------------

  // XXX: not consider codes (e.g., =Foo::Bar=)
  definitionPattern: /^(.*?) :: *(.*)$/,

  parseList: function () {
    var rootToken = this.lexer.peekNextToken();
    var list;
    var isDefinitionList = false;

    if (this.definitionPattern.test(rootToken.content)) {
      list = Node.createDefinitionList([]);
      isDefinitionList = true;
    } else {
      list = rootToken.type === Lexer.tokens.unorderedListElement ?
        Node.createUnorderedList([]) : Node.createOrderedList([]);
    }
    this.setNodeOriginFromToken(list, rootToken);

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (!nextToken.isListElement() || nextToken.indentation !== rootToken.indentation)
        break;
      list.appendChild(this.parseListElement(rootToken.indentation, isDefinitionList));
    }

    return list;
  },

  unknownDefinitionTerm: "???",

  parseListElement: function (rootIndentation, isDefinitionList) {
    var listElementToken = this.lexer.getNextToken();
    var listElement = Node.createListElement([]);
    this.setNodeOriginFromToken(listElement, listElementToken);

    listElement.isDefinitionList = isDefinitionList;

    if (isDefinitionList) {
      var match = this.definitionPattern.exec(listElementToken.content);
      listElement.term = [
        this.createTextNode(match && match[1] ? match[1] : this.unknownDefinitionTerm)
      ];
      listElement.appendChild(this.createTextNode(match ? match[2] : listElementToken.content));
    } else {
      listElement.appendChild(this.createTextNode(listElementToken.content));
    }

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
        listElement.appendChild(element);
    }

    return listElement;
  },

  // ------------------------------------------------------------
  // <Table> ::= <TableRow>+
  // ------------------------------------------------------------

  parseTable: function () {
    var nextToken = this.lexer.peekNextToken();
    var table = Node.createTable([]);
    this.setNodeOriginFromToken(table, nextToken);
    var sawSeparator = false;

    var allowMultilineCell = nextToken.type === Lexer.tokens.tableSeparator && this.options.multilineCell;

    while (this.lexer.hasNext() &&
           (nextToken = this.lexer.peekNextToken()).isTableElement()) {
      if (nextToken.type === Lexer.tokens.tableRow) {
        var tableRow = this.parseTableRow(allowMultilineCell);
        table.appendChild(tableRow);
      } else {
        // Lexer.tokens.tableSeparator
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

  parseTableRow: function (allowMultilineCell) {
    var tableRowTokens = [];

    while (this.lexer.peekNextToken().type === Lexer.tokens.tableRow) {
      tableRowTokens.push(this.lexer.getNextToken());
      if (!allowMultilineCell) {
        break;
      }
    }

    if (!tableRowTokens.length) {
      throw this.createErrorReport("Expected table row");
    }

    var firstTableRowToken = tableRowTokens.shift();
    var tableCellTexts = firstTableRowToken.content.split("|");

    tableRowTokens.forEach(function (rowToken) {
      rowToken.content.split("|").forEach(function (cellText, cellIdx) {
        tableCellTexts[cellIdx] = (tableCellTexts[cellIdx] || "") + "\n" + cellText;
      });
    });

    // TODO: Prepare two pathes: (1)
    var tableCells = tableCellTexts.map(
      // TODO: consider '|' escape?
      function (text) {
        return Node.createTableCell(Parser.parseStream(text));
      }, this);

    return this.setNodeOriginFromToken(Node.createTableRow(tableCells), firstTableRowToken);
  },

  // ------------------------------------------------------------
  // <Directive> ::= "#+.*"
  // ------------------------------------------------------------

  parseDirective: function () {
    var directiveToken = this.lexer.getNextToken();
    var directiveNode = this.createDirectiveNodeFromToken(directiveToken);

    if (directiveToken.endDirective)
      throw this.createErrorReport("Unmatched 'end' directive for " + directiveNode.directiveName);

    if (directiveToken.oneshotDirective) {
      this.interpretDirective(directiveNode);
      return directiveNode;
    }

    if (!directiveToken.beginDirective)
      throw this.createErrorReport("Invalid directive " + directiveNode.directiveName);

    // Parse begin ~ end
    directiveNode.children = [];
    if (this.isVerbatimDirective(directiveNode))
      return this.parseDirectiveBlockVerbatim(directiveNode);
    else
      return this.parseDirectiveBlock(directiveNode);
  },

  createDirectiveNodeFromToken: function (directiveToken) {
    var matched = /^[ ]*([^ ]*)[ ]*(.*)[ ]*$/.exec(directiveToken.content);

    var directiveNode = Node.createDirective(null);
    this.setNodeOriginFromToken(directiveNode, directiveToken);
    directiveNode.directiveName = matched[1].toLowerCase();
    directiveNode.directiveArguments = this.parseDirectiveArguments(matched[2]);
    directiveNode.directiveOptions = this.parseDirectiveOptions(matched[2]);
    directiveNode.directiveRawValue = matched[2];

    return directiveNode;
  },

  isVerbatimDirective: function (directiveNode) {
    var directiveName = directiveNode.directiveName;
    return directiveName === "src" || directiveName === "example" || directiveName === "html";
  },

  parseDirectiveBlock: function (directiveNode, verbatim) {
    this.lexer.pushDummyTokenByType(Lexer.tokens.blank);

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.type === Lexer.tokens.directive &&
          nextToken.endDirective &&
          this.createDirectiveNodeFromToken(nextToken).directiveName === directiveNode.directiveName) {
        // Close directive
        this.lexer.getNextToken();
        return directiveNode;
      }
      var element = this.parseElementBesidesDirectiveEnd();
      if (element)
        directiveNode.appendChild(element);
    }

    throw this.createErrorReport("Unclosed directive " + directiveNode.directiveName);
  },

  parseDirectiveBlockVerbatim: function (directiveNode) {
    var textContent = [];

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.type === Lexer.tokens.directive &&
          nextToken.endDirective &&
          this.createDirectiveNodeFromToken(nextToken).directiveName === directiveNode.directiveName) {
        this.lexer.getNextToken();
        directiveNode.appendChild(this.createTextNode(textContent.join("\n"), true));
        return directiveNode;
      }
      textContent.push(this.lexer.stream.getNextLine());
    }

    throw this.createErrorReport("Unclosed directive " + directiveNode.directiveName);
  },

  parseDirectiveArguments: function (parameters) {
    return parameters.split(/[ ]+/).filter(function (param) {
      return param.length && param[0] !== "-";
    });
  },

  parseDirectiveOptions: function (parameters) {
    return parameters.split(/[ ]+/).filter(function (param) {
      return param.length && param[0] === "-";
    });
  },

  interpretDirective: function (directiveNode) {
    // http://orgmode.org/manual/Export-options.html
    switch (directiveNode.directiveName) {
    case "options:":
      this.interpretOptionDirective(directiveNode);
      break;
    case "title:":
      this.document.title = directiveNode.directiveRawValue;
      break;
    case "author:":
      this.document.author = directiveNode.directiveRawValue;
      break;
    case "email:":
      this.document.email = directiveNode.directiveRawValue;
      break;
    default:
      this.document.directiveValues[directiveNode.directiveName] = directiveNode.directiveRawValue;
      break;
    }
  },

  interpretOptionDirective: function (optionDirectiveNode) {
    optionDirectiveNode.directiveArguments.forEach(function (pairString) {
      var pair = pairString.split(":");
      this.options[pair[0]] = this.convertLispyValue(pair[1]);
    }, this);
  },

  convertLispyValue: function (lispyValue) {
    switch (lispyValue) {
    case "t":
      return true;
    case "nil":
      return false;
    default:
      if (/^[0-9]+$/.test(lispyValue))
        return parseInt(lispyValue);
      return lispyValue;
    }
  },

  // ------------------------------------------------------------
  // <Paragraph> ::= <Blank> <Line>*
  // ------------------------------------------------------------

  parseParagraph: function () {
    var paragraphFisrtToken = this.lexer.peekNextToken();
    var paragraph = Node.createParagraph([]);
    this.setNodeOriginFromToken(paragraph, paragraphFisrtToken);

    var textContents = [];

    while (this.lexer.hasNext()) {
      var nextToken = this.lexer.peekNextToken();
      if (nextToken.type !== Lexer.tokens.line
          || nextToken.indentation < paragraphFisrtToken.indentation)
        break;
      this.lexer.getNextToken();
      textContents.push(nextToken.content);
    }

    paragraph.appendChild(this.createTextNode(textContents.join("\n")));

    return paragraph;
  },

  parseText: function (noEmphasis) {
    var lineToken = this.lexer.getNextToken();
    return this.createTextNode(lineToken.content, noEmphasis);
  },

  // ------------------------------------------------------------
  // <Text> (DOM Like)
  // ------------------------------------------------------------

  createTextNode: function (text, noEmphasis) {
    return noEmphasis ? Node.createText(null, { value: text })
      : this.inlineParser.parseEmphasis(text);
  }
};
Parser.prototype.originalParseElement = Parser.prototype.parseElement;

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

    if (result.length === 1) {
      // Avoid duplicated inline container wrapping
      return result[0];
    } else {
      return Node.createInlineContainer(result);
    }
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
        link.appendChild(this.parseEmphasis(title));
        linkPattern.lastIndex = savedLastIndex;
      } else {
        link.appendChild(Node.createText(null, { value: src }));
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
      "([" + this.preEmphasis + "]|^|\r?\n)" +               // \1 => pre
        "([" + this.markers + "])" +                         // \2 => marker
        "([^" + this.borderForbidden + "]|" +                // \3 => body
        "[^" + this.borderForbidden + "]" +
        this.bodyRegexp +
        "[^" + this.borderForbidden + "])" +
        "\\2" +
        "([" + this.postEmphasis +"]|$|\r?\n)",              // \4 => post
        // flags
        "g"
    );
  }
};

if (typeof exports !== "undefined") {
  exports.Parser = Parser;
  exports.InlineParser = InlineParser;
}
