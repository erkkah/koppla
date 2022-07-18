"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const compiler_1 = require("./compiler");
const renderer_1 = require("./renderer");
async function main() {
    const source = `
    [R1] - [22k]`;
    const parsed = (0, parser_1.parse)(source);
    const compiled = (0, compiler_1.compile)(parsed);
    const rendered = await (0, renderer_1.render)(compiled);
    console.log(rendered);
}
main()
    .then(() => {
    //
})
    .catch((err) => {
    console.log(err);
});
