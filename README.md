org-js
======

Parser and converter for org-mode (<http://orgmode.org/>) notation written in JavaScript.

Interactive Editor
------------------

For working example, see http://mooz.github.com/org-js/editor/.

Installation
------------

    npm install org

Development setup (TODO)
------------

requires `ruby` (`stub/module-exporter/export.rb`)

Building
------------

Assuming you have all necessary dependencies installed, run:

    ./build.sh

this generates `./org.js`, which can be directly included into a webpage for
browser-based usage.

To add e.g. a new converter, place your converter file into `org/converter`,
and add a corresponding

    `exportModule(require("./org/converter/newconverter.js"));`

line to `lib/org.js` to include it into your build.

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

### HTML conversion options

- `recordHeader` output section header numbers (1, 2, 2.1, 2.2, 3...)

Conversion from the command line
--------------------------------

```sh
cat $PATH_TO_INPUT_FILE.org | ./org2html.js > $PATH_TO_OUTPUT_FILE.html
```

Writing yet another converter
-----------------------------

See `lib/org/converter/html.js`.


Parser logic (TODO)
-------------------

1. syntax type declarations (not definitions) go inside `lib/org/node.js`. For example,
    
    Node.define("link", function (node, options) {
      node.src = options.src;
    });
    Node.define("timestmamp");

This automatically has a few effects:
    1. dynamically creates a `Node.types.$TYPENAME`
       constant.  In this example, `Node.types.link` and
       `Node.types.timestamp`
    2. dynamically creates a `Node.create$TYPE` function,
       which is used to build the node object of the given
       type.
    3. causes the parser (`lib/org/parser.js`) to look
       for: a `parse$TYPE` function; in the above example,
       this will be `parseLink` and `parseTimestamp`.
    4. causes the converter (`lib/org/converter.js`) to
       look for `convertLink` and `convertTimestamp`

Thus, after you define the corresponding parser function
in `parser.js`, you must also write the corresponding
converter.

The parser should return a `Node` derived type. For
example, if you are using the `Timestamp` type, the parser
function should return an element created by
`Node.createTimestamp()`.

2. In order to figure out the Inline parser precedence,
   you must trace the parser function call order. More
   concretely, other words, if you have a `text` object
   that gets passed into `parseEmphasis`, which calls
   `parseLink`.  If `parseLink` fails to find a link, it
   passes the text to the next parser down the hierarchy.
   Currently, that parser is the `parseTimestamp` parser.
   If `parseTimestamp` fails to find a timestamp, it will
   finally return a plain text node, created by
   `Node.createText()`.
