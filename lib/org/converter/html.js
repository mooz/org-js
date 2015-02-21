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
    var titleHTML = this.tag("h" + Math.max(Number(this.headerOffset), 1), title);
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

  // Method to construct org-js generated class
  orgClassName: function (className) {
    return this.exportOptions.htmlClassPrefix ?
      this.exportOptions.htmlClassPrefix + className
      : className;
  },

  // Method to construct org-js generated id
  orgId: function (id) {
    return this.exportOptions.htmlIdPrefix ?
      this.exportOptions.htmlIdPrefix + id
      : id;
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
    if (this.exportOptions.suppressCheckboxHandling) {
      return this.tag("li", childText, null, auxData);
    } else {
      var listItemAttributes = {};
      var listItemText = childText;
      // Embed checkbox
      if (/^\s*\[(X| |-)\]([\s\S]*)/.exec(listItemText)) {
        listItemText = RegExp.$2 ;
        var checkboxIndicator = RegExp.$1;

        var checkboxAttributes = { type: "checkbox" };
        switch (checkboxIndicator) {
        case "X":
          checkboxAttributes["checked"] = "true";
          listItemAttributes["data-checkbox-status"] = "done";
          break;
        case "-":
          listItemAttributes["data-checkbox-status"] = "intermediate";
          break;
        default:
          listItemAttributes["data-checkbox-status"] = "undone";
          break;
        }

        listItemText = this.inlineTag("input", null, checkboxAttributes) + listItemText;
      }

      return this.tag("li", listItemText, listItemAttributes, auxData);
    }
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
    var srcParameterStripped = this.stripParametersFromURL(node.src);
    if (this.imageExtensionPattern.exec(srcParameterStripped)) {
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

  // @override
  convertHTML: function (node, childText, auxData) {
    if (node.directiveName === "html:") {
      return node.directiveRawValue;
    } else if (node.directiveName === "html") {
      return node.children.map(function (textNode) {
        return textNode.value;
      }).join("\n");
    } else {
      return childText;
    }
  },

  // @implement
  convertHeaderBlock: function (headerBlock, level, index) {
    level = level || 0;
    index = index || 0;

    var contents = [];

    var headerNode = headerBlock.header;
    if (headerNode) {
      contents.push(this.convertNode(headerNode));
    }

    var blockContent = this.convertNodes(headerBlock.childNodes);
    contents.push(blockContent);

    var childBlockContent = headerBlock.childBlocks
          .map(function (block, idx) {
            return this.convertHeaderBlock(block, level + 1, idx);
          }, this)
          .join("\n");
    contents.push(childBlockContent);

    var contentsText = contents.join("\n");

    if (headerNode) {
      return this.tag("section", "\n" + contents.join("\n"), {
        "class": "block block-level-" + level
      });
    } else {
      return contentsText;
    }
  },

  // ----------------------------------------------------
  // Supplemental methods
  // ----------------------------------------------------

  replaceMap: {
    // [replacing pattern, predicate]
    "&": ["&#38;", null],
    "<": ["&#60;", null],
    ">": ["&#62;", null],
    '"': ["&#34;", null],
    "'": ["&#39;", null],
    "->": ["&#10132;", function (text, insideCodeElement) {
      return this.exportOptions.translateSymbolArrow && !insideCodeElement;
    }]
  },

  replaceRegexp: null,

  // @implement @override
  escapeSpecialChars: function (text, insideCodeElement) {
    if (!this.replaceRegexp) {
      this.replaceRegexp = new RegExp(Object.keys(this.replaceMap).join("|"), "g");
    }

    var replaceMap = this.replaceMap;
    var self = this;
    return text.replace(this.replaceRegexp, function (matched) {
      if (!replaceMap[matched]) {
        throw Error("escapeSpecialChars: Invalid match");
      }

      var predicate = replaceMap[matched][1];
      if (typeof predicate === "function" &&
          !predicate.call(self, text, insideCodeElement)) {
        // Not fullfill the predicate
        return matched;
      }

      return replaceMap[matched][0];
    });
  },

  // @implement
  postProcess: function (node, currentText, insideCodeElement) {
    if (this.exportOptions.exportFromLineNumber &&
        typeof node.fromLineNumber === "number") {
      // Wrap with line number information
      currentText = this.inlineTag("div", currentText, {
        "data-line-number": node.fromLineNumber
      });
    }
    return currentText;
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
        var attributeValue = attributesObject[attributeName];
        // To avoid id/class name conflicts with other frameworks,
        // users can add arbitrary prefix to org-js generated
        // ids/classes via exportOptions.
        if (attributeName === "class") {
          attributeValue = this.orgClassName(attributeValue);
        } else if (attributeName === "id") {
          attributeValue = this.orgId(attributeValue);
        }
        attributesString += " " + attributeName + "=\"" + attributeValue + "\"";
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
