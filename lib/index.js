"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const parser_1 = require("./parser");
const compiler_1 = require("./compiler");
const renderer_1 = require("./renderer");
const symbols_1 = require("./symbols");
const skin_1 = require("./skin");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const skinFile = (0, path_1.join)(__dirname, "..", "Electrical_symbols_library.svg");
function parseArgs(args) {
    if (args.length < 3) {
        console.log("Expected koppla file argument");
        process.exit(1);
    }
    return {
        input: args[2]
    };
}
async function main(args) {
    const commandLine = parseArgs(args);
    const input = await (0, promises_1.readFile)(commandLine.input);
    const parsed = (0, parser_1.parse)(input.toString());
    const symbols = new symbols_1.CoreSymbols();
    const compiled = (0, compiler_1.compile)(parsed, symbols);
    const skin = new skin_1.Skin();
    await skin.load(skinFile);
    const rendered = await (0, renderer_1.render)(compiled, symbols, skin, { optimize: true });
    console.log(rendered);
}
main(process.argv)
    .then(() => {
    //
})
    .catch((err) => {
    console.log(err);
});
//# sourceMappingURL=index.js.map