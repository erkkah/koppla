import "source-map-support/register";

import { parse } from "./parser";
import { compile } from "./compiler";
import { render } from "./renderer";
import { CoreSymbols } from "./symbols";
import { Skin } from "./skin";
import { extname } from "path";
import { readFile, writeFile } from "fs/promises";
import { findResource } from "./resources";

interface Options {
    input: string;
    output: string;
    fontFile: string;
    fontSize: number;
}

function parseOption(option: string): [string, string] {
    const matches = option.match(/^-+(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches.length === 3 ? matches[2] : "true";
    return [name, value];
}

function parseArgs(args: string[]): Options {
    const files: string[] = [];
    const options: Options = {
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
        } else {
            files.push(arg);
        }
    }

    if (files.length < 1) {
        console.log("Expected koppla file argument");
        process.exit(1);
    }

    options.input = files[0];
    if (options.output.length === 0) {
        options.output = options.input.replace(
            new RegExp(`${extname(options.input)}$`),
            ".svg"
        );
    }
    return options;
}

async function main(args: string[]) {
    const options = parseArgs(args.slice(2));

    if (options.fontFile === "") {
        options.fontFile = findResource("fonts/inconsolata.regular.woff");
    }

    const skin = new Skin();
    const skinFile = findResource("symbols/library.svg");
    await skin.load(skinFile);

    const symbols = await CoreSymbols.load("symbols/symbols.json");

    const input = await readFile(options.input);
    const parsed = parse(input.toString(), options.input);
    const compiled = compile(parsed, symbols);

    let rendered: string = "";

    try {
        rendered = await render(compiled, symbols, skin, {
            optimize: true,
            fontFile: options.fontFile,
            fontSize: options.fontSize,
        });
    } catch (err) {
        console.log(`Rendering failed: ${err}`);
    }
    await writeFile(options.output, rendered);
}

main(process.argv)
    .then(() => {
        //
    })
    .catch((err) => {
        console.log(err.stack);
    });
