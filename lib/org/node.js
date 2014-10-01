function PrototypeNode(type, children) {
  this.type = type;
  this.children = [];

  if (children) {
    for (var i = 0, len = children.length; i < len; ++i) {
      this.appendChild(children[i]);
    }
  }
}
PrototypeNode.prototype = {
  previousSibling: null,
  parent: null,
  get firstChild() {
    return this.children.length < 1 ?
      null : this.children[0];
  },
  get lastChild() {
    return this.children.length < 1 ?
      null : this.children[this.children.length - 1];
  },
  appendChild: function (newChild) {
    var previousSibling = this.children.length < 1 ?
          null : this.lastChild;
    this.children.push(newChild);
    newChild.previousSibling = previousSibling;
    newChild.parent = this;
  },
  toString: function () {
    var string = "<" + this.type + ">";

    if (typeof this.value !== "undefined") {
      string += " " + this.value;
    } else if (this.children) {
      string += "\n" + this.children.map(function (child, idx) {
        return "#" + idx + " " + child.toString();
      }).join("\n").split("\n").map(function (line) {
        return "  " + line;
      }).join("\n");
    }

    return string;
  }
};

var Node = {
  types: {},

  define: function (name, postProcess) {
    this.types[name] = name;

    var methodName = "create" + name.substring(0, 1).toUpperCase() + name.substring(1);
    var postProcessGiven = typeof postProcess === "function";

    this[methodName] = function (children, options) {
      var node = new PrototypeNode(name, children);

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
