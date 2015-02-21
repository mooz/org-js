var Node = require("../node.js").Node;

function Converter() {
}

Converter.prototype = {
  exportOptions: {
    headerOffset: 1,
    exportFromLineNumber: false,
    suppressSubScriptHandling: false,
    suppressAutoLink: false,
    // HTML
    translateSymbolArrow: false,
    suppressCheckboxHandling: false,
    // { "directive:": function (node, childText, auxData) {} }
    customDirectiveHandler: null,
    // e.g., "org-js-"
    htmlClassPrefix: null,
    htmlIdPrefix: null
  },

  untitled: "Untitled",
  result: null,

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

  createTocItem: function (headerNode, parentTocs) {
    var childTocs = [];
    childTocs.parent = parentTocs;
    var tocItem = { headerNode: headerNode, childTocs: childTocs };
    return tocItem;
  },

  computeToc: function (exportTocLevel) {
    if (typeof exportTocLevel !== "number")
      exportTocLevel = Infinity;

    var toc = [];
    toc.parent = null;

    var previousLevel = 1;
    var currentTocs = toc;  // first

    for (var i = 0; i < this.headers.length; ++i) {
      var headerNode = this.headers[i];

      if (headerNode.level > exportTocLevel)
        continue;

      var levelDiff = headerNode.level - previousLevel;
      if (levelDiff > 0) {
        for (var j = 0; j < levelDiff; ++j) {
          if (currentTocs.length === 0) {
            // Create a dummy tocItem
            var dummyHeader = Node.createHeader([], {
              level: previousLevel + j
            });
            dummyHeader.sectionNumberText = "";
            currentTocs.push(this.createTocItem(dummyHeader, currentTocs));
          }
          currentTocs = currentTocs[currentTocs.length - 1].childTocs;
        }
      } else if (levelDiff < 0) {
        levelDiff = -levelDiff;
        for (var k = 0; k < levelDiff; ++k) {
          currentTocs = currentTocs.parent;
        }
      }

      currentTocs.push(this.createTocItem(headerNode, currentTocs));

      previousLevel = headerNode.level;
    }

    return toc;
  },

  convertNode: function (node, recordHeader, insideCodeElement) {
    if (!insideCodeElement) {
      if (node.type === Node.types.directive) {
        if (node.directiveName === "example" ||
            node.directiveName === "src") {
          insideCodeElement = true;
        }
      } else if (node.type === Node.types.preformatted) {
        insideCodeElement = true;
      }
    }

    if (typeof node === "string") {
      node = Node.createText(null, { value: node });
    }

    var childText = node.children ? this.convertNodesInternal(node.children, recordHeader, insideCodeElement) : "";
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
        var previousHeaderLevel = this.sectionNumbers.length;
        if (thisHeaderLevel > previousHeaderLevel) {
          // Fill missing section number
          var levelDiff = thisHeaderLevel - previousHeaderLevel;
          for (var j = 0; j < levelDiff; ++j) {
            this.sectionNumbers[thisHeaderLevel - 1 - j] = 0; // Extend
          }
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
        var termText = this.convertNodesInternal(node.term, recordHeader, insideCodeElement);
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
      case "html":
      case "html:":
        text = this.convertHTML(node, childText, auxData);
        break;
      default:
        if (this.exportOptions.customDirectiveHandler &&
            this.exportOptions.customDirectiveHandler[node.directiveName]) {
          text = this.exportOptions.customDirectiveHandler[node.directiveName](
            node, childText, auxData
          );
        } else {
          text = childText;
        }
      }
      break;
    case Node.types.text:
      text = this.convertText(node.value, insideCodeElement);
      break;
    default:
      throw Error("Unknown node type: " + node.type);
    }

    if (typeof this.postProcess === "function") {
      text = this.postProcess(node, text, insideCodeElement);
    }

    return text;
  },

  convertText: function (text, insideCodeElement) {
    var escapedText = this.escapeSpecialChars(text, insideCodeElement);

    if (!this.exportOptions.suppressSubScriptHandling && !insideCodeElement) {
      escapedText = this.makeSubscripts(escapedText, insideCodeElement);
    }
    if (!this.exportOptions.suppressAutoLink) {
      escapedText = this.linkURL(escapedText);
    }

    return escapedText;
  },

  // By default, ignore html
  convertHTML: function (node, childText, auxData) {
    return childText;
  },

  convertNodesInternal: function (nodes, recordHeader, insideCodeElement) {
    var nodesTexts = [];
    for (var i = 0; i < nodes.length; ++i) {
      var node = nodes[i];
      var nodeText = this.convertNode(node, recordHeader, insideCodeElement);
      nodesTexts.push(nodeText);
    }
    return this.combineNodesTexts(nodesTexts);
  },

  convertHeaderBlock: function (headerBlock, recordHeader) {
    throw Error("convertHeaderBlock is not implemented");
  },

  convertHeaderTree: function (headerTree, recordHeader) {
    return this.convertHeaderBlock(headerTree, recordHeader);
  },

  convertNodesToHeaderTree: function (nodes, nextBlockBegin, blockHeader) {
    var childBlocks = [];
    var childNodes = [];

    if (typeof nextBlockBegin === "undefined") {
      nextBlockBegin = 0;
    }
    if (typeof blockHeader === "undefined") {
      blockHeader = null;
    }

    for (var i = nextBlockBegin; i < nodes.length;) {
      var node = nodes[i];

      var isHeader = node.type === Node.types.header;

      if (!isHeader) {
        childNodes.push(node);
        i = i + 1;
        continue;
      }

      // Header
      if (blockHeader && node.level <= blockHeader.level) {
        // Finish Block
        break;
      } else {
        // blockHeader.level < node.level
        // Begin child block
        var childBlock = this.convertNodesToHeaderTree(nodes, i + 1, node);
        childBlocks.push(childBlock);
        i = childBlock.nextIndex;
      }
    }

    // Finish block
    return {
      header: blockHeader,
      childNodes: childNodes,
      nextIndex: i,
      childBlocks: childBlocks
    };
  },

  convertNodes: function (nodes, recordHeader, insideCodeElement) {
    return this.convertNodesInternal(nodes, recordHeader, insideCodeElement);
  },

  combineNodesTexts: function (nodesTexts) {
    return nodesTexts.join("");
  },

  getNodeTextContent: function (node) {
    if (node.type === Node.types.text)
      return this.escapeSpecialChars(node.value);
    else
      return node.children ? node.children.map(this.getNodeTextContent, this).join("") : "";
  },

  // @Override
  escapeSpecialChars: function (text) {
    throw Error("Implement escapeSpecialChars");
  },

  // http://daringfireball.net/2010/07/improved_regex_for_matching_urls
  urlPattern: /\b(?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/ig,

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
    throw Error("Implement makeLink");
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
    throw Error("Implement makeSubscript");
  },

  stripParametersFromURL: function (url) {
    return url.replace(/\?.*$/, "");
  },

  imageExtensionPattern: new RegExp("(" + [
    "bmp", "png", "jpeg", "jpg", "gif", "tiff",
    "tif", "xbm", "xpm", "pbm", "pgm", "ppm", "svg"
  ].join("|") + ")$", "i")
};

if (typeof exports !== "undefined")
  exports.Converter = Converter;
