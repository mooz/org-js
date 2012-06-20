var Org = (function () {
  var exports = {};

  var Node = {
    types: {},
  
    define: function (name, postProcess) {
      this.types[name] = name;
  
      var methodName = "create" + name.substring(0, 1).toUpperCase() + name.substring(1);
      var postProcessGiven = typeof postProcess === "function";
  
      this[methodName] = function (children, options) {
        var node = {
          type: name,
          children: children
        };
  
        if (postProcessGiven)
          postProcess(node, options || {});
  
        return node;
      };
    }
  };
  
  Node.define("text", function (node, options) {
    node.value = options.value;
  });
  Node.define("header", function (node, options) {
    node.level = options.level;
  });
  Node.define("orderedList");
  Node.define("unorderedList");
  Node.define("definitionList");
  Node.define("listElement");
  Node.define("paragraph");
  Node.define("preformatted");
  Node.define("table");
  Node.define("tableRow");
  Node.define("tableCell");
  Node.define("horizontalRule");
  Node.define("directive");
  
  // Inline
  Node.define("inlineContainer");
  
  Node.define("bold");
  Node.define("italic");
  Node.define("underline");
  Node.define("code");
  Node.define("verbatim");
  Node.define("dashed");
  Node.define("link", function (node, options) {
    node.src = options.src;
  });
  
  if (typeof exports !== "undefined")
    exports.Node = Node;
  
  function Stream(sequence) {
    this.sequences = sequence.split(/\r?\n/);
    this.totalLines = this.sequences.length;
    this.lineNumber = 0;
  }
  
  Stream.prototype.peekNextLine = function () {
    return this.hasNext() ? this.sequences[this.lineNumber] : null;
  };
  
  Stream.prototype.getNextLine = function () {
    return this.hasNext() ? this.sequences[this.lineNumber++] : null;
  };
  
  Stream.prototype.hasNext = function () {
    return this.lineNumber < this.totalLines;
  };
  
  if (typeof exports !== "undefined") {
    exports.Stream = Stream;
  }
  
  // ------------------------------------------------------------
  // Syntax
  // ------------------------------------------------------------
  
  var Syntax = {
    rules: {},
  
    define: function (name, syntax) {
      this.rules[name] = syntax;
      var methodName = "is" + name.substring(0, 1).toUpperCase() + name.substring(1);
      this[methodName] = function (line) {
        return this.rules[name].exec(line);
      };
    }
  };
  
  Syntax.define("header", /^(\*+)\s+(.*)$/); // m[1] => level, m[2] => content
  Syntax.define("preformatted", /^(\s*):(?: (.*)$|$)/); // m[1] => indentation, m[2] => content
  Syntax.define("unorderedListElement", /^(\s*)(?:-|\+|\s+\*)\s+(.*)$/); // m[1] => indentation, m[2] => content
  Syntax.define("orderedListElement", /^(\s*)(\d+)(?:\.|\))\s+(.*)$/); // m[1] => indentation, m[2] => number, m[3] => content
  Syntax.define("tableSeparator", /^(\s*)\|((?:\+|-)*?)\|?$/); // m[1] => indentation, m[2] => content
  Syntax.define("tableRow", /^(\s*)\|(.*?)\|?$/); // m[1] => indentation, m[2] => content
  Syntax.define("blank", /^$/);
  Syntax.define("horizontalRule", /^(\s*)-{5,}$/); //
  Syntax.define("directive", /^(\s*)#\+(?:(begin|end)_)?(.*)$/i); // m[1] => indentation, m[2] => type, m[3] => content
  Syntax.define("comment", /^(\s*)#(.*)$/);
  Syntax.define("line", /^(\s*)(.*)$/);
  
  // ------------------------------------------------------------
  // Token
  // ------------------------------------------------------------
  
  function Token() {
  }
  
  Token.prototype = {
    isListElement: function () {
      return this.type === Lexer.tokens.orderedListElement ||
        this.type === Lexer.tokens.unorderedListElement;
    },
  
    isTableElement: function () {
      return this.type === Lexer.tokens.tableSeparator ||
        this.type === Lexer.tokens.tableRow;
    }
  };
  
  // ------------------------------------------------------------
  // Lexer
  // ------------------------------------------------------------
  
  function Lexer(stream) {
    this.stream = stream;
    this.tokenStack = [];
  }
  
  Lexer.prototype = {
    tokenize: function (line) {
      var token = new Token();
      token.fromLineNumber = this.stream.lineNumber;
  
      if (Syntax.isHeader(line)) {
        token.type        = Lexer.tokens.header;
        token.indentation = 0;
        token.content     = RegExp.$2;
        // specific
        token.level       = RegExp.$1.length;
      } else if (Syntax.isPreformatted(line)) {
        token.type        = Lexer.tokens.preformatted;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$2;
      } else if (Syntax.isUnorderedListElement(line)) {
        token.type        = Lexer.tokens.unorderedListElement;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$2;
      } else if (Syntax.isOrderedListElement(line)) {
        token.type        = Lexer.tokens.orderedListElement;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$3;
        // specific
        token.number      = RegExp.$2;
      } else if (Syntax.isTableSeparator(line)) {
        token.type        = Lexer.tokens.tableSeparator;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$2;
      } else if (Syntax.isTableRow(line)) {
        token.type        = Lexer.tokens.tableRow;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$2;
      } else if (Syntax.isBlank(line)) {
        token.type        = Lexer.tokens.blank;
        token.indentation = 0;
        token.content     = null;
      } else if (Syntax.isHorizontalRule(line)) {
        token.type        = Lexer.tokens.horizontalRule;
        token.indentation = RegExp.$1.length;
        token.content     = null;
      } else if (Syntax.isDirective(line)) {
        token.type        = Lexer.tokens.directive;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$3;
        // decide directive type (begin, end or oneshot)
        var directiveTypeString = RegExp.$2;
        if (/^begin/i.test(directiveTypeString))
          token.beginDirective = true;
        else if (/^end/i.test(directiveTypeString))
          token.endDirective = true;
        else
          token.oneshotDirective = true;
      } else if (Syntax.isComment(line)) {
        token.type        = Lexer.tokens.comment;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$2;
      } else if (Syntax.isLine(line)) {
        token.type        = Lexer.tokens.line;
        token.indentation = RegExp.$1.length;
        token.content     = RegExp.$2;
      } else {
        throw new Error("SyntaxError: Unknown line: " + line);
      }
  
      return token;
    },
  
    pushToken: function (token) {
      this.tokenStack.push(token);
    },
  
    pushDummyTokenByType: function (type) {
      var token = new Token();
      token.type = type;
      this.tokenStack.push(token);
    },
  
    peekStackedToken: function () {
      return this.tokenStack.length > 0 ?
        this.tokenStack[this.tokenStack.length - 1] : null;
    },
  
    getStackedToken: function () {
      return this.tokenStack.length > 0 ?
        this.tokenStack.pop() : null;
    },
  
    peekNextToken: function () {
      return this.peekStackedToken() ||
        this.tokenize(this.stream.peekNextLine());
    },
  
    getNextToken: function () {
      return this.getStackedToken() ||
        this.tokenize(this.stream.getNextLine());
    },
  
    hasNext: function () {
      return this.stream.hasNext();
    }
  };
  
  Lexer.tokens = {};
  [
    "header",
    "orderedListElement",
    "unorderedListElement",
    "tableRow",
    "tableSeparator",
    "preformatted",
    "line",
    "horizontalRule",
    "blank",
    "directive",
    "comment"
  ].forEach(function (tokenName, i) {
    Lexer.tokens[tokenName] = i;
  });
  
  // ------------------------------------------------------------
  // Exports
  // ------------------------------------------------------------
  
  if (typeof exports !== "undefined")
    exports.Lexer = Lexer;
  
  // var Stream = require("./stream.js").Stream;
  // var Lexer  = require("./lexer.js").Lexer;
  // var Node   = require("./node.js").Node;
  
  function Parser() {
    this.inlineParser = new InlineParser();
  }
  
  Parser.prototype = {
    initStatus: function (stream) {
      if (typeof stream === "string")
        stream = new Stream(stream);
      this.lexer = new Lexer(stream);
      this.nodes = [];
      this.options = {
        toc: true,
        num: true,
        "^": "{}"
      };
      this.document = {
        options : this.options
      };
    },
  
    parse: function (stream) {
      this.initStatus(stream);
      this.parseDocument();
      this.document.nodes = this.nodes;
      return this.document;
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
  
    // ------------------------------------------------------------
    // <Document> ::= <Element>*
    // ------------------------------------------------------------
  
    parseDocument: function () {
      this.parseTitle();
  
      while (this.lexer.hasNext()) {
        var element = this.parseElement();
        if (element) this.nodes.push(element);
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
  
      preformatted.children.push(this.createTextNode(textContents.join("\n"), true /* no emphasis */));
  
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
        list.children.push(this.parseListElement(rootToken.indentation, isDefinitionList));
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
        listElement.children.push(this.createTextNode(match ? match[2] : listElementToken.content));
      } else {
        listElement.children.push(this.createTextNode(listElementToken.content));
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
          listElement.children.push(element);
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
      var tableCells = tableRowToken.content
            .split("|")           // TODO: consider '|' escape?
            .map(function (text) {
              return Node.createTableCell([
                this.createTextNode(text)
              ]);
            }, this);
  
      return this.setNodeOriginFromToken(Node.createTableRow(tableCells), tableRowToken);
    },
  
    // ------------------------------------------------------------
    // <Directive> ::= "#+.*"
    // ------------------------------------------------------------
  
    parseDirective: function () {
      var directiveToken = this.lexer.getNextToken();
      var directiveNode = this.createDirectiveNodeFromToken(directiveToken);
  
      if (directiveToken.endDirective)
        throw new Error("Unmatched 'end' directive for " + directiveNode.directiveName);
  
      if (directiveToken.oneshotDirective) {
        this.interpretDirective(directiveNode);
        return directiveNode;
      }
  
      if (!directiveToken.beginDirective)
        throw new Error("Invalid directive " + directiveNode.directiveName);
  
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
      return directiveName === "src" || directiveName === "example";
    },
  
    parseDirectiveBlock: function (directiveNode, verbatim) {
      while (this.lexer.hasNext()) {
        var nextToken = this.lexer.peekNextToken();
        if (nextToken.type === Lexer.tokens.directive &&
            nextToken.endDirective &&
            this.createDirectiveNodeFromToken(nextToken).directiveName === directiveNode.directiveName) {
          this.lexer.getNextToken();
          return directiveNode;
        }
        var element = this.parseElement();
        if (element)
          directiveNode.children.push(element);
      }
  
      throw new Error("Unclosed directive " + directiveNode.directiveName);
    },
  
    parseDirectiveBlockVerbatim: function (directiveNode) {
      var textContent = [];
  
      while (this.lexer.hasNext()) {
        var nextToken = this.lexer.peekNextToken();
        if (nextToken.type === Lexer.tokens.directive &&
            nextToken.endDirective &&
            this.createDirectiveNodeFromToken(nextToken).directiveName === directiveNode.directiveName) {
          this.lexer.getNextToken();
          directiveNode.children.push(this.createTextNode(textContent.join("\n"), true));
          return directiveNode;
        }
        textContent.push(this.lexer.stream.getNextLine());
      }
  
      throw new Error("Unclosed directive " + directiveNode.directiveName);
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
      switch (directiveNode.directiveName) {
      case "option":
        this.interpretOptionDirective(directiveNode);
        break;
      case "title":
        this.document.title = directiveNode.directiveRawValue;
        break;
      case "author":
        this.document.author = directiveNode.directiveRawValue;
        break;
      case "email":
        this.document.email = directiveNode.directiveRawValue;
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
  
      paragraph.children.push(this.createTextNode(textContents.join("\n")));
  
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
  
  // var Node = require("./node.js").Node;
  
  var HtmlTextConverter = {
    convertDocument: function (doc, exportOptions) {
      this.documentOptions = doc.options || {};
      this.exportOptions = exportOptions || {};
      this.initialize(doc);
  
      var title = doc.title ? this.convertNode(doc.title) : "Untitled";
      var titleHTML = this.tag("h1", title);
      var contentHTML = this.convertNodes(doc.nodes, true /* record headers */);
      var tocHTML = this.generateToc(this.documentOptions["toc"]);
  
      return titleHTML + tocHTML + this.tag("hr", null) + contentHTML;
    },
  
    initialize: function () {
      this.headers = [];
      this.headerOffset = typeof this.exportOptions.headerOffset === "number" ? this.headerOffset : 1;
      this.sectionNumbers = [0];
    },
  
    // Call after convertNodes
    generateToc: function (exportTocLevel) {
      if (!exportTocLevel)
        return "";
  
      if (typeof exportTocLevel !== "number")
        exportTocLevel = Infinity;
  
      var toc = [];
  
      function repeat(text, n) {
        return Array(n + 1).join(text);
      }
  
      var sectionNumbers = [0];
      var unclosedUlCount = 0;
      var previousLevel = 0;
      for (var i = 0; i < this.headers.length; ++i) {
        var headerNode = this.headers[i];
  
        if (headerNode.level > exportTocLevel)
          continue;
  
        var levelDiff = headerNode.level - previousLevel;
        if (levelDiff > 0) {
          toc.push(repeat("<ul>", levelDiff));
          unclosedUlCount += levelDiff;
          sectionNumbers[headerNode.level - 1] = 0;
        } else if (levelDiff < 0) {
          levelDiff = -levelDiff;
          toc.push(repeat("</ul>", levelDiff));
          unclosedUlCount -= levelDiff;
          sectionNumbers.length = headerNode.level;
        }
  
        sectionNumbers[sectionNumbers.length - 1]++;
  
        var sectionNumber = sectionNumbers.join(".");
        var sectionNumberString = this.documentOptions.num ?
              this.inlineTag("span", sectionNumber, { "class": "section-number" }) : "";
        var headerString = this.convertNodes(headerNode.children);
        var headerLink = this.inlineTag("a", sectionNumberString + headerString, { href: "#header-" + i });
  
        toc.push(this.tag("li", headerLink));
        previousLevel = headerNode.level;
      }
  
      // Close remained <ul>
      if (unclosedUlCount > 0)
        toc.push(repeat("</ul>", unclosedUlCount));
  
      return this.tag("div", toc.join(""), { id: "org-toc" });
    },
  
    getNodeTextContent: function (node) {
      if (node.type === Node.types.text)
        return this.escapeTags(node.value);
      else
        return node.children ? node.children.map(this.getNodeTextContent, this).join("") : "";
    },
  
    convertNode: function (node, recordHeader) {
      var childText = node.children ? this.convertNodes(node.children, recordHeader) : "";
      var text;
  
      switch (node.type) {
      case Node.types.header:
        // Add section number
        if (this.documentOptions.num && recordHeader) {
          var thisHeaderLevel = node.level;
          var levelDiff = null;
          var previousHeaderLevel = this.sectionNumbers.length;
  
          if (thisHeaderLevel > previousHeaderLevel)
            this.sectionNumbers[thisHeaderLevel - 1] = 0; // Extend (TODO: fill out skipped elements with 0)
          else if (thisHeaderLevel < previousHeaderLevel)
            this.sectionNumbers.length = thisHeaderLevel; // Collapse
  
          this.sectionNumbers[thisHeaderLevel - 1]++;
  
          childText = this.inlineTag("span", this.sectionNumbers.join("."), {
            "class": "section-number"
          }) + childText;
        }
  
        text = this.tag("h" + (this.headerOffset + thisHeaderLevel), childText, { id: "header-" + this.headers.length });
        if (recordHeader)
          this.headers.push(node);
        break;
      case Node.types.orderedList:
        text = this.tag("ol", childText);
        break;
      case Node.types.unorderedList:
        text = this.tag("ul", childText);
        break;
      case Node.types.definitionList:
        text = this.tag("dl", childText);
        break;
      case Node.types.listElement:
        if (node.isDefinitionList) {
          var termText = this.convertNodes(node.term, recordHeader);
          text = this.tag("dt", termText) + this.tag("dd", childText);
        } else {
          text = this.tag("li", childText);
        }
        break;
      case Node.types.paragraph:
        text = this.tag("p", childText);
        break;
      case Node.types.preformatted:
        text = this.tag("pre", childText);
        break;
      case Node.types.table:
        // TODO: Consider <col> or <colgroup>
        text = this.tag("table", this.tag("tbody", childText));
        break;
      case Node.types.tableRow:
        text = this.tag("tr", childText);
        break;
      case Node.types.tableCell:
        if (node.isHeader)
          text = this.tag("th", childText);
        else
          text = this.tag("td", childText);
        break;
      case Node.types.horizontalRule:
        text = this.tag("hr", null);
        break;
        // ============================================================ //
        // Inline
        // ============================================================ //
      case Node.types.inlineContainer:
        text = childText;
        break;
      case Node.types.bold:
        text = this.inlineTag("b", childText);
        break;
      case Node.types.italic:
        text = this.inlineTag("i", childText);
        break;
      case Node.types.underline:
        text = this.inlineTag("span", childText, { style: "text-decoration:underline;" });
        break;
      case Node.types.code:
        text = this.inlineTag("code", childText);
        break;
      case Node.types.dashed:
        text = this.inlineTag("del", childText);
        break;
      case Node.types.link:
        if (this.imageExtensionPattern.exec(node.src)) {
          var imgText = this.getNodeTextContent(node);
          text = this.inlineTag("img", null, { src: node.src, alt: imgText, title: imgText });
        } else
          text = this.inlineTag("a", childText, { href: node.src });
        break;
      case Node.types.directive:
        var tagName;
        var tagOptions = {};
  
        switch (node.directiveName) {
        case "quote":
          tagName = "blockquote";
          break;
        case "example":
          tagName = "pre";
          break;
        case "src":
          tagName = "pre";
          tagOptions["class"] = "prettyprint";
  
          var codeLanguage = node.directiveArguments.length
                ? node.directiveArguments[0]
                : "unknown";
          childText = this.tag("code", childText, { "class": "language-" + codeLanguage });
          break;
        }
  
        if (tagName)
          text = this.tag(tagName, childText, tagOptions);
        else
          text = childText;
        break;
      case Node.types.text:
        text = this.linkURL(this.makeSubscripts(this.escapeTags(node.value)));
        break;
      default:
        if (typeof node === "string")
          text = this.linkURL(this.makeSubscripts(this.escapeTags(node)));
        break;
      }
  
      if (this.exportOptions.exportFromLineNumber && typeof node.fromLineNumber === "number") {
        text = this.inlineTag("div", text, {
          "class": "org-line-container",
          "data-line-number": node.fromLineNumber
        });
      }
  
      return text;
    },
  
    inlineTag: function (name, innerText, attributes) {
      attributes = attributes || {};
  
      var htmlString = "<" + name;
      // Add attributes
      for (var attributeName in attributes) {
        if (attributes.hasOwnProperty(attributeName)) {
          htmlString += " " + attributeName + "=\"" + attributes[attributeName] + "\"";
        }
      }
  
      if (innerText === null)
        return htmlString + "/>";
  
      htmlString += ">" + innerText + "</" + name + ">";
  
      return htmlString;
    },
  
    tag: function (name, innerText, attributes) {
      return this.inlineTag(name, innerText, attributes) + "\n";
    },
  
    // http://daringfireball.net/2010/07/improved_regex_for_matching_urls
    urlPattern: /\b(?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/i,
  
    linkURL: function (text) {
      return text.replace(this.urlPattern, function (matched) {
        if (matched.indexOf("://") < 0)
          matched = "http://" + matched;
        return "<a href=\"" + matched + "\">" + decodeURIComponent(matched) + "</a>";
      });
    },
  
    makeSubscripts: function (text) {
      console.log("make suhbscript: |" + this.documentOptions["^"] + "|");
      var replacee = "<span class=\"org-subscript-parent\">$1</span><span class=\"org-subscript-child\">$2</span>";
      if (this.documentOptions["^"] === "{}")
        return text.replace(/\b([^_ \t]*)_{([^}]*)}/g, replacee);
      else if (this.documentOptions["^"])
        return text.replace(/\b([^_ \t]*)_([^_]*)\b/g, replacee);
      else
        return text;
    },
  
    convertNodes: function (nodes, recordHeader) {
      return nodes.map(function (node) {
        return this.convertNode(node, recordHeader);
      }, this).join("");
    },
  
    escapeTags: function (text) {
      return text.replace(/[&<>"']/g, function (matched) {
        return "&#" + matched.charCodeAt(0) + ';';
      });
    },
  
    imageExtensionPattern: new RegExp("(" + [
      "bmp", "png", "jpeg", "jpg", "gif", "tiff",
      "tif", "xbm", "xpm", "pbm", "pgm", "ppm"
    ].join("|") + ")$")
  };
  
  if (typeof exports !== "undefined")
    exports.HtmlTextConverter = HtmlTextConverter;

  return exports;
})();
