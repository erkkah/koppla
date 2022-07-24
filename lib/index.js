"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
const parser_1 = require("./parser");
const compiler_1 = require("./compiler");
const renderer_1 = require("./renderer");
const symbols_1 = require("./symbols");
const skin_1 = require("./skin");
const path_1 = require("path");
const skinFile = (0, path_1.join)(__dirname, "..", "Electrical_symbols_library.svg");
async function main() {
    const symbols = new symbols_1.CoreSymbols();
    const source = `
    [R1] - [22k] [R1] - |4.7u|`;
    const parsed = (0, parser_1.parse)(source);
    const compiled = (0, compiler_1.compile)(parsed, symbols);
    const skin = new skin_1.Skin();
    await skin.load(skinFile);
    const rendered = await (0, renderer_1.render)(compiled, symbols, skin, { optimize: true });
    console.log(rendered);
}
main()
    .then(() => {
    //
})
    .catch((err) => {
    console.log(err);
});
//# sourceMappingURL=index.js.map