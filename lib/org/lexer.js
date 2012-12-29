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
  },

  getLineNumber: function () {
    return this.stream.lineNumber;
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
