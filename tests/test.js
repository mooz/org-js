const test = require("tape");
const org = require("../lib/org");
const Parser = org.Parser;
const Node = org.Node;

test("test inline conversion", t => {
    var parser = new Parser();

    function convert(input) {
        var doc = parser.parse(input);
        // FIXME: this is not piecemeal
        var out = doc.convert(org.ConverterHTML, {
            headerOffset: 0,
            exportFromLineNumber: false,
            suppressSubscriptHandling: true,
            suppressAutoLink: true
        });
        return out.contentHTML;
    }

    [
        ["dummy", "dummy"],
    ].forEach(pair => {
        var given = pair[0],
            expected = pair[1],
            received = convert(given);
        console.log(expected, received);
        t.equal(expected, received);
    });

    t.end();
});

test("test document conversion 1", t => {
    var parser = new Parser();

    var doc = parser.parse([
      ": hogehoge",
      ": hugahuga",
      "This is a paragraph,",
      "desu.",
      "",
      "2nd Paragraph",
      "",
      "- foo",
      " - bar :: hoge",
      "- baz"
    ].join("\n"));

    var out = doc.convert(org.ConverterHTML, {
        htmlClassPrefix: "org-",
        headerOffset: 0,
        exportFromLineNumber: false,
        suppressSubscriptHandling: false,
        suppressAutoLink: false
    });
    console.log(out.contentHTML)
    t.end();
});
