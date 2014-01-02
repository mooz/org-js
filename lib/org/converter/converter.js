var Node = require("../node.js").Node;

function Converter() {
}

Converter.prototype = {
  exportOptions: {
    headerOffset: 1,
    exportFromLineNumber: false,
    suppressSubScriptHandling: false,
    suppressAutoLink: false
  },

  untitled: "Untitled",
  convertResult: null,

  // TODO: Manage TODO lists

  initialize: function (orgDocument, exportOptions) {
    this.orgDocument = orgDocument;
    this.documentOptions = orgDocument.options || {};
    this.exportOptions = exportOptions || {};

    this.headers = [];
    this.headerOffset =
      typeof this.exportOptions.headerOffset === "number" ? this.exportOptions.headerOffset : 1;
    this.sectionNumbers = [0];
  },

  computeToc: function (exportTocLevel) {
    if (typeof exportTocLevel !== "number")
      exportTocLevel = Infinity;

    var toc = [];
    toc.parent = null;

    var previousLevel = null;
    var currentChildren = toc;  // first

    for (var i = 0; i < this.headers.length; ++i) {
      var headerNode = this.headers[i];

      if (headerNode.level > exportTocLevel)
        continue;

      if (previousLevel !== null) {
        var levelDiff = headerNode.level - previousLevel;
        if (levelDiff > 0) {
          for (var j = 0; j < levelDiff; ++j) {
            currentChildren = currentChildren[currentChildren.length - 1].children;
          }
        } else if (levelDiff < 0) {
          levelDiff = -levelDiff;
          for (var k = 0; k < levelDiff; ++k) {
            currentChildren = currentChildren.parent;
          }
        }
      }

      var children = [];
      children.parent = currentChildren;
      var tocItem = { headerNode: headerNode, children: children };
      currentChildren.push(tocItem);

      previousLevel = headerNode.level;
    }

    return toc;
  },

  convertNode: function (node, recordHeader) {
    var childText = node.children ? this.convertNodes(node.children, recordHeader) : "";
    var text;

    var auxData = this.computeAuxDataForNode(node);

    switch (node.type) {
    case Node.types.header:
      // Parse task status
      var taskStatus = null;
      if (childText.indexOf("TODO ") === 0)
        taskStatus = "todo";
      else if (childText.indexOf("DONE ") === 0)
        taskStatus = "done";

      // Compute section number
      var sectionNumberText = null;
      if (recordHeader) {
        var thisHeaderLevel = node.level;
        var levelDiff = null;
        var previousHeaderLevel = this.sectionNumbers.length;
        if (thisHeaderLevel > previousHeaderLevel) {
          // TODO: fill out skipped elements with 0 (by performing for loop)
          this.sectionNumbers[thisHeaderLevel - 1] = 0; // Extend
        } else if (thisHeaderLevel < previousHeaderLevel) {
          this.sectionNumbers.length = thisHeaderLevel; // Collapse
        }
        this.sectionNumbers[thisHeaderLevel - 1]++;
        sectionNumberText = this.sectionNumbers.join(".");
        node.sectionNumberText = sectionNumberText; // Can be used in ToC
      }

      text = this.convertHeader(node, childText, auxData,
                                taskStatus, sectionNumberText);

      if (recordHeader)
        this.headers.push(node);
      break;
    case Node.types.orderedList:
      text = this.convertOrderedList(node, childText, auxData);
      break;
    case Node.types.unorderedList:
      text = this.convertUnorderedList(node, childText, auxData);
      break;
    case Node.types.definitionList:
      text = this.convertDefinitionList(node, childText, auxData);
      break;
    case Node.types.listElement:
      if (node.isDefinitionList) {
        var termText = this.convertNodes(node.term, recordHeader);
        text = this.convertDefinitionItem(node, childText, auxData,
                                          termText, childText);
      } else {
        text = this.convertListItem(node, childText, auxData);
      }
      break;
    case Node.types.paragraph:
      text = this.convertParagraph(node, childText, auxData);
      break;
    case Node.types.preformatted:
      text = this.convertPreformatted(node, childText, auxData);
      break;
    case Node.types.table:
      text = this.convertTable(node, childText, auxData);
      break;
    case Node.types.tableRow:
      text = this.convertTableRow(node, childText, auxData);
      break;
    case Node.types.tableCell:
      if (node.isHeader)
        text = this.convertTableHeader(node, childText, auxData);
      else
        text = this.convertTableCell(node, childText, auxData);
      break;
    case Node.types.horizontalRule:
      text = this.convertHorizontalRule(node, childText, auxData);
      break;
      // ============================================================ //
      // Inline
      // ============================================================ //
    case Node.types.inlineContainer:
      text = this.convertInlineContainer(node, childText, auxData);
      break;
    case Node.types.bold:
      text = this.convertBold(node, childText, auxData);
      break;
    case Node.types.italic:
      text = this.convertItalic(node, childText, auxData);
      break;
    case Node.types.underline:
      text = this.convertUnderline(node, childText, auxData);
      break;
    case Node.types.code:
      text = this.convertCode(node, childText, auxData);
      break;
    case Node.types.dashed:
      text = this.convertDashed(node, childText, auxData);
      break;
    case Node.types.link:
      text = this.convertLink(node, childText, auxData);
      break;
    case Node.types.directive:
      switch (node.directiveName) {
      case "quote":
        text = this.convertQuote(node, childText, auxData);
        break;
      case "example":
        text = this.convertExample(node, childText, auxData);
        break;
      case "src":
        text = this.convertSrc(node, childText, auxData);
        break;
      default:
        text = childText;
      }
      break;
    default:
      var baseText = null;
      if (node.type === Node.types.text) {
        baseText = node.value;
      } else if (typeof node === "string") {
        baseText = node;
      } else {
        throw "Unknown node type: " + node.type;
      }
      text = this.convertText(baseText);
      break;
    }

    if (typeof this.postProcess === "function") {
      text = this.postProcess(node, text);
    }

    return text;
  },

  convertText: function (text) {
    var escapedText = this.escapeSpecialChars(text);
    if (!this.exportOptions.suppressSubScriptHandling)
      escapedText = this.makeSubscripts(escapedText);
    if (!this.exportOptions.suppressAutoLink)
      escapedText = this.linkURL(escapedText);
    return escapedText;
  },

  convertNodes: function (nodes, recordHeader) {
    return nodes.map(function (node) {
      return this.convertNode(node, recordHeader);
    }, this).join("");
  },

  getNodeTextContent: function (node) {
    if (node.type === Node.types.text)
      return this.escapeSpecialChars(node.value);
    else
      return node.children ? node.children.map(this.getNodeTextContent, this).join("") : "";
  },

  // @Override
  escapeSpecialChars: function (text) {
    throw "Implement escapeSpecialChars";
  },

  // http://daringfireball.net/2010/07/improved_regex_for_matching_urls
  urlPattern: /\b(?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/i,

  // @Override
  linkURL: function (text) {
    var self = this;
    return text.replace(this.urlPattern, function (matched) {
      if (matched.indexOf("://") < 0)
        matched = "http://" + matched;
      return self.makeLink(matched);
    });
  },

  makeLink: function (url) {
    throw "Implement makeLink";
  },

  makeSubscripts: function (text) {
    if (this.documentOptions["^"] === "{}")
      return text.replace(/\b([^_ \t]*)_{([^}]*)}/g,
                          this.makeSubscript);
    else if (this.documentOptions["^"])
      return text.replace(/\b([^_ \t]*)_([^_]*)\b/g,
                          this.makeSubscript);
    else
      return text;
  },

  makeSubscript: function (match, body, subscript) {
    throw "Implement makeSubscript";
  },

  imageExtensionPattern: new RegExp("(" + [
    "bmp", "png", "jpeg", "jpg", "gif", "tiff",
    "tif", "xbm", "xpm", "pbm", "pgm", "ppm"
  ].join("|") + ")$")
};

if (typeof exports !== "undefined")
  exports.Converter = Converter;
