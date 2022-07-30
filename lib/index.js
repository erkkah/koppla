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
const resources_1 = require("./resources");
const serve_1 = require("./serve");
function parseOption(option) {
    const matches = option.match(/^-+(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches[2] !== undefined ? matches[2] : "true";
    return [name, value];
}
function parseArgs(args) {
    const files = [];
    const options = {
        input: "",
        fontFile: "",
        output: "",
        fontSize: 20,
        watch: false,
        port: 8080,
    };
    for (const arg of args) {
        if (arg.startsWith("-")) {
            const [name, value] = parseOption(arg);
            switch (name) {
                case "font":
                    options.fontFile = value;
                    break;
                case "svg":
                    options.output = value;
                    break;
                case "watch":
                    options.watch = Boolean(value);
                    break;
                case "port":
                    options.port = Number(value);
                    break;
                default:
                    console.log(`Unknown option ${name}`);
                    process.exit(1);
            }
        }
        else {
            files.push(arg);
        }
    }
    if (files.length < 1) {
        console.log("Expected koppla file argument");
        process.exit(1);
    }
    options.input = files[0];
    if (options.output.length === 0) {
        options.output = options.input.replace(new RegExp(`${(0, path_1.extname)(options.input)}$`), ".svg");
    }
    return options;
}
async function main(args) {
    const options = parseArgs(args.slice(2));
    if (options.fontFile === "") {
        options.fontFile = (0, resources_1.findResource)("fonts/inconsolata.regular.woff");
    }
    const skin = new skin_1.Skin();
    const skinFile = (0, resources_1.findResource)("symbols/library.svg");
    await skin.load(skinFile);
    const symbols = await symbols_1.CoreSymbols.load("symbols/symbols.json");
    if (options.watch) {
        await watchAndRender(options, symbols, skin);
        console.log(`Listening on port ${options.port}`);
    }
    else {
        await renderToFile(options, symbols, skin);
    }
}
async function renderToFile(options, symbols, skin) {
    const input = await (0, promises_1.readFile)(options.input);
    const parsed = (0, parser_1.parse)(input.toString(), options.input);
    const compiled = (0, compiler_1.compile)(parsed, symbols);
    let rendered = "";
    try {
        rendered = await (0, renderer_1.render)(compiled, skin, {
            optimize: true,
            fontFile: options.fontFile,
            fontSize: options.fontSize,
        });
    }
    catch (err) {
        console.log(`Rendering failed: ${err}`);
    }
    await (0, promises_1.writeFile)(options.output, rendered);
}
async function watchAndRender(options, symbols, skin) {
    const template = (await (0, resources_1.loadResource)("static/watch.html")).toString();
    (0, serve_1.serve)(options.input, options.port, async (source) => {
        let rendered = "";
        try {
            const input = await (0, promises_1.readFile)(source);
            const parsed = (0, parser_1.parse)(input.toString(), source);
            const compiled = (0, compiler_1.compile)(parsed, symbols);
            rendered = await (0, renderer_1.render)(compiled, skin, {
                optimize: true,
                fontFile: options.fontFile,
                fontSize: options.fontSize,
            });
        }
        catch (err) {
            rendered = `<pre>${err}</pre>`;
        }
        const content = template.replace("{svg}", rendered);
        return { content, type: "text/html" };
    });
}
main(process.argv)
    .then(() => {
    //
})
    .catch((err) => {
    console.log(`${err}`);
});
//# sourceMappingURL=index.js.map