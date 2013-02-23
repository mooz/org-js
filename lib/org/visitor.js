function Visitor(doc) {
  this.doc = doc;
}

Visitor.prototype = {
  visit: function () {
    this.onStart();
    this.visitNodes(this.doc.nodes);
    return this.onFinish();
  },

  visitNodes: function (nodes) {
    for (var i = 0, len = nodes.length; i < len; ++i) {
      this.visitNode(nodes[i]);
    }
  },

  visitNode: function (node) {
  },

  onStart: function () {
  },

  onFinish: function () {
  }
};

// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

if (typeof exports !== "undefined")
  exports.Visitor = Visitor;
