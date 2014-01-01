org-js
======

Parser and converter for org-mode (<http://orgmode.org/>) notation written in JavaScript.

Interactive Editor
------------------

For working example, see http://mooz.github.com/org-js/editor/.

Installation
------------

    npm install org

Simple example of org -> HTML conversion
----------------------------------------

```javascript
var org = require("org");

var parser = new org.Parser();
var orgDocument = parser.parse(orgCode);
var orgHTMLDocument = orgDocument.convert(org.ConverterHTML, {
  headerOffset: 1,
  exportFromLineNumber: false,
  suppressSubScriptHandling: false,
  suppressAutoLink: false
});

console.dir(orgHTMLDocument); // => { title, contentHTML, tocHTML, toc }
console.log(orgHTMLDocument.toString()) // => Rendered HTML
```

Writing yet another converter
-----------------------------

See `lib/org/converter/html.js`.
