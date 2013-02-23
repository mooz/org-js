var Node = require("./node.js").Node;
var Visitor = require("./visitor.js").Visitor;

function Document(options) {
  this.options = options;
  this.nodes = [];
}

Document.prototype = {
  _previousSibling: null,
  appendNode: function (newNode) {
    this.nodes.push(newNode);
    newNode.previousSibling = this._previousSibling;
    this._previousSibling = newNode;
    // Reset cache
    this._toc = null;
  },

  collectNodesByType: function (nodeType) {
    var nodeCollector = new Visitor(this);

    nodeCollector.collectedNodes = [];
    nodeCollector.visitNode = function (visitingNode) {
      if (visitingNode.type === nodeType) {
        this.collectedNodes.push(visitingNode);
      }
    };
    nodeCollector.visit();

    return nodeCollector.collectedNodes;
  },

  getTableOfContents: function () {
    if (!this._toc)
      this._toc = this.computeTableOfContents();
    return this._toc;
  },

  computeTableOfContents: function (exportTocLevel) {
    if (typeof exportTocLevel !== "number")
      exportTocLevel = Infinity;

    var toc = [];
    var tocTargetHeaders = this.collectNodesByType(Node.types.header)
          .filter(function (header) {
            return exportTocLevel > header.level;
          });

    var tocEntryStack = [];
    for (var i = 0, len = tocTargetHeaders.length; i < len; ++i) {
      var currentHeader = tocTargetHeaders[i];

      while (tocEntryStack.length) {
        var stackTopEntry = tocEntryStack[tocEntryStack.length - 1];
        var stackTocHeader = stackTopEntry.node;

        if (currentHeader.level > stackTopEntry.level) {
          // currentHeader is a child of topHeader
          stackTopEntry.children.push(currentHeader);
          break;
        } else {
          // pop topHeader
          tocEntryStack.pop();
          if (tocEntryStack.length === 0) {
            toc.push(stackTopEntry); // add toc entry
          }
        }
      }

      // Next
      tocEntryStack.push({
        node: currentHeader,
        children: []
      });
    }

    return toc;
  }
};

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

if (typeof exports !== "undefined")
  exports.Document = Document;
