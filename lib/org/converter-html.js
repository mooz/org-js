var Node = require("./node.js").Node;

var HtmlTextConverter = {
  convertDocument: function (doc) {
    this.initialize();

    var title = doc.title ? this.convertNode(doc.title) : "untitled";
    var titleHTML = this.tag("h1", title);
    var contentHTML = this.convertNodes(doc.nodes, true /* record headers */);
    var tocHTML = this.generateToc();

    return titleHTML + tocHTML + contentHTML;
  },

  initialize: function () {
    this.headers = [];
  },

  // Call after convertNodes
  generateToc: function () {
    var toc = [];

    function repeat(text, n) {
      return Array(n + 1).join(text);
    }

    var unclosedUlCount = 0;
    var previousLevel = 0;
    for (var i = 0; i < this.headers.length; ++i) {
      var headerNode = this.headers[i];

      var entry = this.tag(
        "li",
        this.inlineTag(
          "a",
          this.convertNodes(headerNode.children), { href: "#header-" + i }
        )
      );

      var levelDiff = headerNode.level - previousLevel;
      if (levelDiff > 0) {
        toc.push(repeat("<ul>", levelDiff));
        unclosedUlCount += levelDiff;
      } else if (levelDiff < 0) {
        levelDiff = -levelDiff;
        toc.push(repeat("</ul>", levelDiff));
        unclosedUlCount -= levelDiff;
      }

      toc.push(entry);
      previousLevel = headerNode.level;
    }

    // Close remained <ul>
    if (unclosedUlCount > 0)
      toc.push(repeat("</ul>", unclosedUlCount));

    return toc.join("");
  },

  convertNode: function (node, recordHeader) {
    var childText = node.children ? this.convertNodes(node.children, recordHeader) : "";
    var text;

    switch (node.type) {
    case Node.types.text:
      text = this.linkURL(this.escapeTags(node.value));
      break;
    case Node.types.header:
      var level = node.level + 1;
      text = this.tag("h" + level, childText, { id: "header-" + this.headers.length });
      if (recordHeader)
        this.headers.push(node);
      break;
    case Node.types.orderedList:
      text = this.tag("ol", childText);
      break;
    case Node.types.unorderedList:
      text = this.tag("ul", childText);
      break;
    case Node.types.definitionList:
      text = this.tag("dl", childText);
      break;
    case Node.types.listElement:
      if (node.isDefinitionList) {
        var termText = this.convertNodes(node.term, recordHeader);
        text = this.tag("dt", termText) + this.tag("dd", childText);
      } else {
        text = this.tag("li", childText);
      }
      break;
    case Node.types.paragraph:
      text = this.tag("p", childText);
      break;
    case Node.types.preformatted:
      text = this.tag("pre", childText);
      break;
    case Node.types.table:
      // TODO: Consider <col> or <colgroup>
      text = this.tag("table", this.tag("tbody", childText));
      break;
    case Node.types.tableRow:
      text = this.tag("tr", childText);
      break;
    case Node.types.tableCell:
      if (node.isHeader)
        text = this.tag("th", childText);
      else
        text = this.tag("td", childText);
      break;
    case Node.types.horizontalRule:
      text = this.tag("hr", null);
      break;
      // ============================================================ //
      // Inline
      // ============================================================ //
    case Node.types.inlineContainer:
      text = childText;
      break;
    case Node.types.bold:
      text = this.inlineTag("b", childText);
      break;
    case Node.types.italic:
      text = this.inlineTag("i", childText);
      break;
    case Node.types.underline:
      text = this.inlineTag("span", childText, { style: "text-decoration:underline;" });
      break;
    case Node.types.code:
      text = this.inlineTag("code", childText);
      break;
    case Node.types.dashed:
      text = this.inlineTag("del", childText);
      break;
    case Node.types.link:
      if (this.imageExtensionPattern.exec(node.src))
        text = this.inlineTag("img", childText, { src: node.src, alt: childText });
      else
        text = this.inlineTag("a", childText, { href: node.src });
      break;
    }

    return text;
  },

  inlineTag: function (name, innerText, attributes) {
    if (innerText === null)
      return "<" + name + "/>";

    attributes = attributes || {};

    var htmlString = "<" + name;
    // Add attributes
    for (var attributeName in attributes) {
      if (attributes.hasOwnProperty(attributeName)) {
        htmlString += " " + attributeName + "=\"" + attributes[attributeName] + "\"";
      }
    }
    htmlString += ">" + innerText + "</" + name + ">";

    return htmlString;
  },

  tag: function (name, innerText, attributes) {
    return this.inlineTag(name, innerText, attributes) + "\n";
  },

  // http://daringfireball.net/2010/07/improved_regex_for_matching_urls
  urlPattern: /\b(?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'".,<>?«»“”‘’])/i,

  linkURL: function (text) {
    return text.replace(this.urlPattern, function (matched) {
      if (matched.indexOf("://") < 0)
        matched = "http://" + matched;
      return "<a href=\"" + matched + "\">" + matched + "</a>";
    });
  },

  convertNodes: function (nodes, recordHeader) {
    return nodes.map(function (node) {
      return this.convertNode(node, recordHeader);
    }, this).join("");
  },

  escapeTags: function (text) {
    return text.replace(/[&<>"']/g, function (matched) {
      return "&#" + matched.charCodeAt(0) + ';';
    });
  },

  imageExtensionPattern: new RegExp("(" + [
    "bmp", "png", "jpeg", "jpg", "gif", "tiff",
    "tif", "xbm", "xpm", "pbm", "pgm", "ppm"
  ].join("|") + ")$")
};

if (typeof exports !== "undefined")
  exports.HtmlTextConverter = HtmlTextConverter;
