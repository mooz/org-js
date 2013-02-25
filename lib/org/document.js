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

  visitNodes: function (visitNodeFunction, onStartFunction, onFinishFunction) {
    var visitor = new Visitor(this);
    visitor.visitNode = visitNodeFunction;
    if (typeof onStartFunction === "function")
      visitor.onStart = onStartFunction;
    if (typeof onFinishFunction === "function")
      visitor.onFinish = onFinishFunction;
    return visitor.visit();
  },

  collectNodesByType: function (nodeType) {
    return this.visitNodes(function visitNode(visitingNode) {
      if (visitingNode.type === nodeType) {
        this.collectedNodes.push(visitingNode);
      }
    }, function onStart() {
      this.collectedNodes = [];
    }, function onFinish() {
      return this.collectedNodes;
    });
  },

  attachSectionNumberToHeader: function () {
    var toc = this.getTableOfContents();

    function attachNumbers(tocEntries, prefix) {
      for (var i = 0, len = tocEntries.length; i < len; ++i) {
        var tocEntry = tocEntries[i];
        var sectionNumberText = prefix ? prefix + "." + (i + 1) : (i + 1);
        if (tocEntry.node)
          tocEntry.node.sectionNumberText = sectionNumberText;
        if (tocEntry.children.length > 0)
          attachNumbers(tocEntry.children, sectionNumberText);
      }
    }

    attachNumbers(toc);
  },

  getTableOfContents: function (exportTocLevel) {
    if (!this._toc)
      this._toc = {};
    if (!this._toc[exportTocLevel])
      this._toc[exportTocLevel] = this.computeTableOfContents(exportTocLevel);
    return this._toc[exportTocLevel];
  },

  computeTableOfContents: function (exportTocLevel) {
    if (typeof exportTocLevel !== "number")
      exportTocLevel = Infinity;

    var tocTargetHeaders = this.collectNodesByType(Node.types.header)
          .filter(function (header) { return exportTocLevel > header.level; });

    return this.constructHeaderTreesAtLevel(tocTargetHeaders, 1);
  },

  // Divide and conquer:
  //
  // 1) divide array with lowest level x
  //
  // [1, 2, 2, 3, 4, 2, 1, 2, 3, 3, 1, 2, 3, 4]
  // => [1, 2, 2, 3, 4, 2] / [1, 2, 3, 3] / [1, 2, 3, 4]
  //
  // 2) remove first element from each sub-arrays
  //
  // => [2, 2, 3, 4, 2] / [2, 3, 3] / [2, 3, 4]
  //
  // then, recursively divide each sub arrays with x + 1
  //
  // => [[2], [2, 3, 4], [2]] / [[2, 3, 3]] / [[2, 3, 4]]
  constructHeaderTreesAtLevel: function (headers, rootHeaderLevel) {
    if (!headers.length)
      return [];

    var that = this;

    var rootHeader = null;
    var childHeaders = [];

    var subtreeRootEntries = [];
    function addRootHeaderEntry(newRootHeader) {
      subtreeRootEntries.push({
        node: rootHeader,
        children: that.constructHeaderTreesAtLevel(childHeaders, rootHeaderLevel + 1)
      });
    }

    function beginNewSubtreeWithRoot(newRootHeader) {
      rootHeader = newRootHeader;
      childHeaders = [];
    }

    for (var i = 0, len = headers.length; i < len; ++i) {
      var header = headers[i];

      if (i === 0 && header.level === rootHeaderLevel) {
        // Skip first element:
        // ex) given [1, 2, 3, 1, 2] with divideHeaderLevel = 1, skip first 1
        beginNewSubtreeWithRoot(header);
        continue;
      }

      if (header.level <= rootHeaderLevel) {
        addRootHeaderEntry(rootHeader);
        beginNewSubtreeWithRoot(header);
      } else {
        childHeaders.push(header);
      }
    }
    addRootHeaderEntry(rootHeader);

    return subtreeRootEntries;
  }
};

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

if (typeof exports !== "undefined")
  exports.Document = Document;
