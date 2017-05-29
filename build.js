const Path = require("path"),
      fs = require("fs"),
      {exec} = require("child_process");

const DIR_BASE = __dirname,
      DIR_EXPORTER = Path.join(DIR_BASE, "stub", "module-exporter"),
      DIR_ORGJS = Path.join(DIR_BASE, "lib", "org"),
      EXPORT_RB = "export.rb";
      OUT_FILE = "org.js";

var ruby_build_command = [
    Path.join(DIR_EXPORTER, EXPORT_RB),
    Path.join(DIR_ORGJS, "*.js"),
    Path.join(DIR_ORGJS, "converter", "*.js"),
].join(" ");

exec(ruby_build_command, (err, stdout, stderr) => {
    fs.writeFileSync(OUT_FILE, [
            // HEADER
            "// Generated by "+EXPORT_RB+" at "+new Date(),
            // LICENSE
            "/*\n"
                + (fs.readFileSync("LICENSE", "utf-8")
                   .replace(/^(.+)/gm, "  $1", "g"))
                + "*/\n",
            stdout].join("\n"));
});
