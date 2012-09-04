var Node = require("./node.js").Node;

var RedmineConverter = {
  convertDocument: function (doc, exportOptions) {
    this.documentOptions = doc.options || {};
    this.exportOptions = exportOptions || {};
    this.initialize(doc);

    var title = doc.title ? this.convertNode(doc.title) : "Untitled";
    var titlePart = "h1. " + title;
    var contentPart = this.convertNodes(doc.nodes, false);

    return titlePart + "\n\n" + contentPart;
  },

  initialize: function () {
    this.headers = [];
    this.headerOffset = typeof this.exportOptions.headerOffset === "number" ? this.headerOffset : 0;
    this.sectionNumbers = [0];
  },

  getNodeTextContent: function (node) {
    if (node.type === Node.types.text)
      return node.value;
    else
      return node.children ? node.children.map(this.getNodeTextContent, this).join("") : "";
  },

  convertNode: function (node, parentInfo) {
    var self = this;
    function getChildText(info) {
      return node.children ? self.convertNodes(node.children, info || parentInfo) : "";
    }
    var text;

    switch (node.type) {
    case Node.types.header:
      // Add section number
      var thisHeaderLevel = node.level;
      var headerCount = this.headerOffset + thisHeaderLevel;
      text = "\nh" + headerCount + ". " + getChildText() + "\n";
      break;
    case Node.types.orderedList:
      text = getChildText({ type: "orderedList", depth: 0 });
      break;
    case Node.types.unorderedList:
      text = getChildText({ type: "unorderedList", depth: 0 });
      break;
    case Node.types.definitionList:
      text = getChildText({ type: "definitionList", depth: 0 });
      break;
    case Node.types.listElement:
      text = "* " + getChildText() + "\n";
      // var currentDepth = parentInfo.depth + 1;
      // var childText = getChildText({ type: parentInfo.type, depth: currentDepth }) + "\n";

      // function repeat(text) {
      //   return Array(currentDepth + 1).join(text);
      // }

      // switch (parentInfo) {
      // case "orderedList":
      //   text = repeat("*") + childText;
      //   break;
      // case "unorderedList":
      //   text = repeat("#") + childText;
      //   break;
      // }
      break;
    case Node.types.paragraph:
      text = "\n" + getChildText() + "\n";
      break;
    case Node.types.preformatted:
      text = "<pre>" + getChildText() + "</pre>\n";
      break;
    case Node.types.table:
    //   text = this.tag("table", this.tag("tbody", getChildText()), null, auxAttributesText);
    //   break;
    // case Node.types.tableRow:
    //   text = this.tag("tr", getChildText());
    //   break;
    // case Node.types.tableCell:
    //   if (node.isHeader)
    //     text = this.tag("th", getChildText());
    //   else
    //     text = this.tag("td", getChildText());
    //   break;
    // case Node.types.horizontalRule:
    //   text = "----\n";
      break;
      // ============================================================ //
      // Inline
      // ============================================================ //
    case Node.types.inlineContainer:
      text = getChildText();
      break;
    case Node.types.bold:
      text = "*" + getChildText() + "*";
      break;
    case Node.types.italic:
      text = "_" + getChildText() + "_";
      break;
    case Node.types.underline:
      text = "+" + getChildText() + "+";
      break;
    case Node.types.code:
      text = "@" + getChildText() + "@";
      break;
    case Node.types.dashed:
      text = "-" + getChildText() + "-";
      break;
    case Node.types.link:
      if (this.imageExtensionPattern.exec(node.src))
        text = "!" + node.src + "!";
      else
        text = "\"" + getChildText() + "\"" + ":" + node.src;
      break;
    case Node.types.directive:
      switch (node.directiveName) {
      case "quote":
        text = getChildText().split("\n").map(function (line) { return ">" + line; }).join("\n");
        break;
      case "example":
        text = "<pre>" + text + "</pre>\n";
        break;
      case "src":
        var codeLanguage = node.directiveArguments.length
              ? node.directiveArguments[0]
              : "unknown";
        text = "<pre><code class=\"" + codeLanguage + "\">" + text + "</code></pre>\n";
        break;
      }
      break;
    case Node.types.text:
      text = this.getNodeTextContent(node);
      break;
    default:
      if (typeof node === "string")
        text = node;
      break;
    }

    return text;
  },

  convertNodes: function (nodes, parentInfo) {
    return nodes.map(function (node, parentInfo) {
      return this.convertNode(node);
    }, this).join("");
  },

  imageExtensionPattern: new RegExp("(" + [
    "bmp", "png", "jpeg", "jpg", "gif", "tiff",
    "tif", "xbm", "xpm", "pbm", "pgm", "ppm"
  ].join("|") + ")$")
};

if (typeof exports !== "undefined")
  exports.RedmineConverter = RedmineConverter;

