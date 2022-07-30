import "source-map-support/register";

import { parse } from "./parser";
import { compile } from "./compiler";
import { render } from "./renderer";
import { CoreSymbols } from "./symbols";
import { Skin } from "./skin";
import { extname } from "path";
import { readFile, writeFile } from "fs/promises";
import { findResource, loadResource } from "./resources";
import { serve } from "./serve";

interface Options {
    input: string;
    output: string;
    fontFile: string;
    fontSize: number;
    watch: boolean;
    port: number;
}

function parseOption(option: string): [string, string] {
    const matches = option.match(/^-+(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches[2] !== undefined ? matches[2] : "true";
    return [name, value];
}

function parseArgs(args: string[]): Options {
    const files: string[] = [];
    const options: Options = {
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

    if (options.watch) {
        await watchAndRender(options, symbols, skin);
        console.log(`Listening on port ${options.port}`);
    } else {
        await renderToFile(options, symbols, skin);
    }
}

async function renderToFile(
    options: Options,
    symbols: CoreSymbols,
    skin: Skin
) {
    const input = await readFile(options.input);
    const parsed = parse(input.toString(), options.input);
    const compiled = compile(parsed, symbols);

    let rendered: string = "";

    try {
        rendered = await render(compiled, skin, {
            optimize: true,
            fontFile: options.fontFile,
            fontSize: options.fontSize,
        });
    } catch (err) {
        console.log(`Rendering failed: ${err}`);
    }
    await writeFile(options.output, rendered);
}

async function watchAndRender(
    options: Options,
    symbols: CoreSymbols,
    skin: Skin
) {
    const template = (await loadResource("static/watch.html")).toString();

    serve(options.input, options.port, async (source) => {
        let rendered: string = "";

        try {
            const input = await readFile(source);
            const parsed = parse(input.toString(), source);
            const compiled = compile(parsed, symbols);

            rendered = await render(compiled, skin, {
                optimize: true,
                fontFile: options.fontFile,
                fontSize: options.fontSize,
            });
        } catch (err) {
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
