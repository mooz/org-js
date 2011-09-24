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
  
  // var Node = require("./node.js").Node;
  
  var HtmlTextConverter = {
    convertDocument: function (doc) {
      var title = doc.title ? this.convertNode(doc.title) : "untitled";
  
      return "<h1>" + title + "</h1>\n"
        + this.convertNodes(doc.nodes);
    },
  
    convertNode: function (node) {
      var childText = node.children ? this.convertNodes(node.children) : "";
      var text;
  
      switch (node.type) {
      case Node.types.text:
        text = node.value;
        break;
      case Node.types.header:
        var level = node.level + 1;
        text = "<h" + level  + ">" + childText + "</h" + level  + ">\n";
        break;
      case Node.types.orderedList:
        text = "<ol>\n" + childText + "</ol>\n";
        break;
      case Node.types.unorderedList:
        text = "<ul>\n" + childText + "</ul>\n";
        break;
      case Node.types.definitionList:
        text = "<dl>\n" + childText + "</dl>\n";
        break;
      case Node.types.listElement:
        if (node.isDefinitionList) {
          var termText = this.convertNodes(node.term);
          text =
            "<dt>" + termText + "</dt>" +
            "<dd>" + childText + "</dd>\n";
        } else {
          text = "<li>" + childText + "</li>\n";
        }
        break;
      case Node.types.paragraph:
        text = "<p>" + childText + "</p>\n";
        break;
      case Node.types.preformatted:
        text = "<pre>" + childText + "</pre>\n";
        break;
      case Node.types.table:
        // TODO: Consider <col> or <colgroup>
        text = "<table>\n<tbody>\n" + childText + "</tbody>\n</table>\n";
        break;
      case Node.types.tableRow:
        text = "<tr>" + childText + "</tr>\n";
        break;
      case Node.types.tableCell:
        if (node.isHeader)
          text = "<th>" + childText + "</th>\n";
        else
          text = "<td>" + childText + "</td>";
        break;
      case Node.types.horizontalRule:
        text = "<hr />\n";
        break;
        // ============================================================ //
        // Inline
        // ============================================================ //
      case Node.types.inlineContainer:
        text = childText;
        break;
      case Node.types.bold:
        text = "<b>" + childText + "</b>";
        break;
      case Node.types.italic:
        text = "<i>" + childText + "</i>";
        break;
      case Node.types.underline:
        text = "<span style='text-decoration:underline;'>" + childText + "</span>";
        break;
      case Node.types.code:
        text = "<code>" + childText + "</code>";
        break;
      case Node.types.dashed:
        text = "<del>" + childText + "</del>";
        break;
      case Node.types.link:
        if (this.imageExtensionPattern.exec(node.src))
          text = "<img src=\"" + node.src + "\" alt=\"" + childText + "\"/>"; // TODO: escape childText
        else
          text = "<a href=\"" + node.src + "\">" + childText + "</a>";
        break;
      }
  
      return text;
    },
  
    convertNodes: function (nodes) {
      return nodes.map(this.convertNode.bind(this)).join("");
    },
  
    imageExtensionPattern: new RegExp("(" + [
      "bmp", "png", "jpeg", "jpg", "gif", "tiff",
      "tif", "xbm", "xpm", "pbm", "pgm", "ppm"
    ].join("|") + ")$")
  };
  
  if (typeof exports !== "undefined")
    exports.HtmlTextConverter = HtmlTextConverter;
  
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
  Syntax.define("preformatted", /^(\s*): (.*)$/); // m[1] => indentation, m[2] => content
  Syntax.define("unorderedListElement", /^(\s*)(?:-|\+|\s+\*)\s+(.*)$/); // m[1] => indentation, m[2] => content
  Syntax.define("orderedListElement", /^(\s*)(\d+)(?:\.|\))\s+(.*)$/); // m[1] => indentation, m[2] => number, m[3] => content
  Syntax.define("tableSeparator", /^(\s*)\|((?:\+|-)*?)\|?$/); // m[1] => indentation, m[2] => content
  Syntax.define("tableRow", /^(\s*)\|(.*?)\|?$/); // m[1] => indentation, m[2] => content
  Syntax.define("blank", /^$/);
  Syntax.define("horizontalRule", /^(\s*)-{5,}$/); //
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
    "comment"
  ].forEach(function (tokenName, i) {
    Lexer.tokens[tokenName] = i;
  });
  
  // ------------------------------------------------------------
  // Exports
  // ------------------------------------------------------------
  
  if (typeof exports !== "undefined")
    exports.Lexer = Lexer;
  
  function Stream(sequence) {
    this.sequences = sequence.split("\n");
    this.sequenceCount = this.sequences.length;
    this.position = 0;
  }
  
  Stream.prototype.peekNextLine = function () {
    return this.hasNext() ? this.sequences[this.position] : null;
  };
  
  Stream.prototype.getNextLine = function () {
    return this.hasNext() ? this.sequences[this.position++] : null;
  };
  
  Stream.prototype.hasNext = function () {
    return this.position < this.sequenceCount;
  };
  
  if (typeof exports !== "undefined") {
    exports.Stream = Stream;
  }
  
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
    },
  
    parse: function (stream) {
      this.initStatus(stream);
      this.parseDocument();
      return {
        nodes  : this.nodes,
        title  : this.title,
        author : this.author
      };
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
        this.title = this.createTextNode(this.lexer.getNextToken().content);
      else
        this.title = null;
  
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
  
    // XXX: not consider codes (e.g., =Foo::Bar=)
    definitionPattern: /^(.*?) :: (.*)$/,
  
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

  return exports;
})();
