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
