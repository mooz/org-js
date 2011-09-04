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
Syntax.define("blank", /^$/);
Syntax.define("unorderedListElement", /^(\s*)(?:-|\+|\s+\*)\s+(.*)$/); // m[1] => indentation, m[2] => content
Syntax.define("orderedListElement", /^(\s*)(\d+)(?:\.|\))\s+(.*)$/); // m[1] => indentation, m[2] => number, m[3] => content
Syntax.define("paragraph", /^(\s*)(.*)$/);

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
    } else if (Syntax.isBlank(line)) {
      token.type        = Lexer.tokens.blank;
      token.indentation = 0;
      token.content     = null;
    } else if (Syntax.isParagraph(line)) {
      token.type        = Lexer.tokens.paragraph;
      token.indentation = RegExp.$1.length;
      token.content     = RegExp.$2;
    } else {
      throw new Error("SyntaxError: Unknown line: " + line);
    }

    return token;
  },

  peekNextToken: function () {
    var token = this.tokenize(this.stream.peekNextLine());
    this._tokenCache = token;
    return token;
  },

  getNextToken: function () {
    var token;
    if (this._tokenCache) {
      token = this._tokenCache;
      this._tokenCache = null;
      this.stream.getNextLine();
    } else {
      token = this.tokenize(this.stream.getNextLine());
    }
    return token;
  },

  hasNext: function () {
    return this.stream.hasNext();
  }
};

Lexer.tokens = {
  header               : 0,
  paragraph            : 1,
  orderedListElement   : 2,
  unorderedListElement : 3,
  blank                : 4,
  table                : 5,
  preformatted         : 6
};

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

if (typeof exports !== "undefined")
  exports.Lexer = Lexer;
