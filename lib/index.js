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
function parseOption(option) {
    const matches = option.match(/^-+(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches.length === 3 ? matches[2] : "true";
    return [name, value];
}
function parseArgs(args) {
    const files = [];
    const options = {
        input: "",
        fontFile: "",
        output: "",
        fontSize: 20,
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
        options.fontFile = (0, resources_1.findResource)("fonts/inconsolata.regular.ttf");
    }
    const skin = new skin_1.Skin();
    const skinFile = (0, resources_1.findResource)("symbols/library.svg");
    await skin.load(skinFile);
    const symbols = new symbols_1.CoreSymbols();
    const input = await (0, promises_1.readFile)(options.input);
    const parsed = (0, parser_1.parse)(input.toString(), options.input);
    const compiled = (0, compiler_1.compile)(parsed, symbols);
    const rendered = await (0, renderer_1.render)(compiled, symbols, skin, {
        optimize: true,
        fontFile: options.fontFile,
        fontSize: options.fontSize,
    });
    await (0, promises_1.writeFile)(options.output, rendered);
}
main(process.argv)
    .then(() => {
    //
})
    .catch((err) => {
    console.log(err);
});
//# sourceMappingURL=index.js.map