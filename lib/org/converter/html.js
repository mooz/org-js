var Converter = require("./converter.js").Converter;
var Node = require("../node.js").Node;

function ConverterHTML(orgDocument, exportOptions) {
  this.initialize(orgDocument, exportOptions);
  this.result = this.convert();
}

ConverterHTML.prototype = {
  __proto__: Converter.prototype,

  convert: function () {
    var title = this.orgDocument.title ? this.convertNode(this.orgDocument.title) : this.untitled;
    var titleHTML = this.tag("h1", title);
    var contentHTML = this.convertNodes(this.orgDocument.nodes, true /* record headers */);
    var toc = this.computeToc(this.documentOptions["toc"]);
    var tocHTML = this.tocToHTML(toc);

    return {
      title: title,
      titleHTML: titleHTML,
      contentHTML: contentHTML,
      tocHTML: tocHTML,
      toc: toc,
      toString: function () {
        return titleHTML + tocHTML + "\n" + contentHTML;
      }
    };
  },

  tocToHTML: function (toc) {
    function tocToHTMLFunction(tocList) {
      var html = "";
      for (var i = 0; i < tocList.length; ++i) {
        var tocItem = tocList[i];
        var sectionNumberText = tocItem.headerNode.sectionNumberText;
        var sectionNumber = this.documentOptions.num ?
              this.inlineTag("span", sectionNumberText, {
                "class": "section-number"
              }) : "";
        var header = this.getNodeTextContent(tocItem.headerNode);
        var headerLink = this.inlineTag("a", sectionNumber + header, {
          href: "#header-" + sectionNumberText.replace(/\./g, "-")
        });
        var subList = tocItem.childTocs.length ? tocToHTMLFunction.call(this, tocItem.childTocs) : "";
        html += this.tag("li", headerLink + subList);
      }
      return this.tag("ul", html);
    }

    return tocToHTMLFunction.call(this, toc);
  },

  computeAuxDataForNode: function (node) {
    while (node.parent &&
           node.parent.type === Node.types.inlineContainer) {
      node = node.parent;
    }
    var attributesNode = node.previousSibling;
    var attributesText = "";
    while (attributesNode &&
           attributesNode.type === Node.types.directive &&
           attributesNode.directiveName === "attr_html:") {
      attributesText += attributesNode.directiveRawValue + " ";
      attributesNode = attributesNode.previousSibling;
    }
    return attributesText;
  },

  // ----------------------------------------------------
  // Node conversion
  // ----------------------------------------------------

  convertHeader: function (node, childText, auxData,
                           taskStatus, sectionNumberText) {
    var headerAttributes = {};

    if (taskStatus) {
      childText = this.inlineTag("span", childText.substring(0, 4), {
        "class": "task-status " + taskStatus
      }) + childText.substring(5);
    }

    if (sectionNumberText) {
      childText = this.inlineTag("span", sectionNumberText, {
        "class": "section-number"
      }) + childText;
      headerAttributes["id"] = "header-" + sectionNumberText.replace(/\./g, "-");
    }

    if (taskStatus)
      headerAttributes["class"] = "task-status " + taskStatus;

    return this.tag("h" + (this.headerOffset + node.level),
                    childText, headerAttributes, auxData);
  },

  convertOrderedList: function (node, childText, auxData) {
    return this.tag("ol", childText, null, auxData);
  },

  convertUnorderedList: function (node, childText, auxData) {
    return this.tag("ul", childText, null, auxData);
  },

  convertDefinitionList: function (node, childText, auxData) {
    return this.tag("dl", childText, null, auxData);
  },

  convertDefinitionItem: function (node, childText, auxData,
                                   term, definition) {
    return this.tag("dt", term) + this.tag("dd", definition);
  },

  convertListItem: function (node, childText, auxData) {
    return this.tag("li", childText, null, auxData);
  },

  convertParagraph: function (node, childText, auxData) {
    return this.tag("p", childText, null, auxData);
  },

  convertPreformatted: function (node, childText, auxData) {
    return this.tag("pre", childText, null, auxData);
  },

  convertTable: function (node, childText, auxData) {
    return this.tag("table", this.tag("tbody", childText), null, auxData);
  },

  convertTableRow: function (node, childText, auxData) {
    return this.tag("tr", childText);
  },

  convertTableHeader: function (node, childText, auxData) {
    return this.tag("th", childText);
  },

  convertTableCell: function (node, childText, auxData) {
    return this.tag("td", childText);
  },

  convertHorizontalRule: function (node, childText, auxData) {
    return this.tag("hr", null, null, auxData);
  },

  convertInlineContainer: function (node, childText, auxData) {
    return childText;
  },

  convertBold: function (node, childText, auxData) {
    return this.inlineTag("b", childText);
  },

  convertItalic: function (node, childText, auxData) {
    return this.inlineTag("i", childText);
  },

  convertUnderline: function (node, childText, auxData) {
    return this.inlineTag("span", childText, {
      style: "text-decoration:underline;"
    });
  },

  convertCode: function (node, childText, auxData) {
    return this.inlineTag("code", childText);
  },

  convertDashed: function (node, childText, auxData) {
    return this.inlineTag("del", childText);
  },

  convertLink: function (node, childText, auxData) {
    if (this.imageExtensionPattern.exec(node.src)) {
      var imgText = this.getNodeTextContent(node);
      return this.inlineTag("img", null, {
        src: node.src,
        alt: imgText,
        title: imgText
      }, auxData);
    } else {
      return this.inlineTag("a", childText, { href: node.src });
    }
  },

  convertQuote: function (node, childText, auxData) {
    return this.tag("blockquote", childText, null, auxData);
  },

  convertExample: function (node, childText, auxData) {
    return this.tag("pre", childText, null, auxData);
  },

  convertSrc: function (node, childText, auxData) {
    var codeLanguage = node.directiveArguments.length
          ? node.directiveArguments[0]
          : "unknown";
    childText = this.tag("code", childText, {
      "class": "language-" + codeLanguage
    }, auxData);
    return this.tag("pre", childText, {
      "class": "prettyprint"
    });
  },

  // ----------------------------------------------------
  // Supplemental methods
  // ----------------------------------------------------

  // @implement @override
  escapeSpecialChars: function (text) {
    return text.replace(/[&<>"']/g, function (matched) {
      return "&#" + matched.charCodeAt(0) + ';';
    });
  },

  // @implement
  postProcess: function (node, text) {
    if (this.exportOptions.exportFromLineNumber &&
        typeof node.fromLineNumber === "number") {
      // Wrap with line number information
      text = this.inlineTag("div", text, {
        "data-line-number": node.fromLineNumber
      });
    }
    return text;
  },

  // @implement
  makeLink: function (url) {
    return "<a href=\"" + url + "\">" + decodeURIComponent(url) + "</a>";
  },

  // @implement
  makeSubscript: function (match, body, subscript) {
    return "<span class=\"org-subscript-parent\">" +
      body +
      "</span><span class=\"org-subscript-child\">" +
      subscript +
      "</span>";
  },

  // ----------------------------------------------------
  // Specific methods
  // ----------------------------------------------------

  attributesObjectToString: function (attributesObject) {
    var attributesString = "";
    for (var attributeName in attributesObject) {
      if (attributesObject.hasOwnProperty(attributeName)) {
        attributesString += " " + attributeName + "=\"" + attributesObject[attributeName] + "\"";
      }
    }
    return attributesString;
  },

  inlineTag: function (name, innerText, attributesObject, auxAttributesText) {
    attributesObject = attributesObject || {};

    var htmlString = "<" + name;
    // TODO: check duplicated attributes
    if (auxAttributesText)
      htmlString += " " + auxAttributesText;
    htmlString += this.attributesObjectToString(attributesObject);

    if (innerText === null)
      return htmlString + "/>";

    htmlString += ">" + innerText + "</" + name + ">";

    return htmlString;
  },

  tag: function (name, innerText, attributesObject, auxAttributesText) {
    return this.inlineTag(name, innerText, attributesObject, auxAttributesText) + "\n";
  }
};

if (typeof exports !== "undefined")
  exports.ConverterHTML = ConverterHTML;
