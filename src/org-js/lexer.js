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
Syntax.define("tableRow", /^(\s*)\|(.*?)\|?$/); // m[1] => indentation, m[2] => content
Syntax.define("blank", /^$/);
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
    } else if (Syntax.isTableRow(line)) {
      token.type        = Lexer.tokens.tableRow;
      token.indentation = RegExp.$1.length;
      token.content     = RegExp.$2;
    } else if (Syntax.isBlank(line)) {
      token.type        = Lexer.tokens.blank;
      token.indentation = 0;
      token.content     = null;
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

Lexer.tokens = {
  header               : 0,
  line                 : 1,
  orderedListElement   : 2,
  unorderedListElement : 3,
  blank                : 4,
  tableRow             : 5,
  preformatted         : 6
};

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

if (typeof exports !== "undefined")
  exports.Lexer = Lexer;
