if (typeof exports !== "undefined") {
  function exportModule(module) {
    for (var exportedName in module) {
      if (module.hasOwnProperty(exportedName)) {
        exports[exportedName] = module[exportedName];
      }
    }
  }

  exportModule(require("./org/parser.js"));
  exportModule(require("./org/lexer.js"));
  exportModule(require("./org/node.js"));
  exportModule(require("./org/parser.js"));
  exportModule(require("./org/stream.js"));
  exportModule(require("./org/converter/html.js"));
}
