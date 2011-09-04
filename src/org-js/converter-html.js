var Node = require("./node.js").Node;

var HtmlTextConverter = {
  convertNode: function (node) {
    var childText = node.children ? this.convertNodes(node.children) : "";
    var text;

    switch (node.type) {
    case Node.types.text:
      text = node.value;
      break;
    case Node.types.header:
      text = "<h" + node.level  + ">" + childText + "</h" + node.level  + ">\n";
      break;
    case Node.types.orderedList:
      text = "<ol>\n" + childText + "</ol>\n";
      break;
    case Node.types.unorderedList:
      text = "<ul>\n" + childText + "</ul>\n";
      break;
    case Node.types.listElement:
      text = "<li>" + childText + "</li>\n";
      break;
    case Node.types.paragraph:
      text = "<p>" + childText + "</p>\n";
      break;
    case Node.types.preformatted:
      text = "<pre>" + childText + "</pre>\n";
      break;
    }

    return text;
  },

  convertNodes: function (nodes) {
    return nodes.map(this.convertNode.bind(this)).join("");
  }
};

if (typeof exports !== "undefined")
  exports.HtmlConverter = HtmlTextConverter;
