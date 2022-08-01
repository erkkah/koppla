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
import { CommandlineOptions, parseArguments } from "./args";

interface Options extends CommandlineOptions {
    input: string;
    output: string;
    fontFile: string;
    fontSize: number;
    watch: boolean;
    port: number;
    help: boolean;
    h: boolean;
}

function usage(message?: string): never {
    if (message) {
        console.log(message);
    }
    console.log(`
usage:
    koppla [options] <input.koppla>

options:
    -output=<output.svg>
    -fontFile=<font.ttf>
    -fontSize=<font size in pixels>
    -watch
    -port=<preview port, defaults to 8080>
`);
    process.exit(1);
}

function parseArgs(args: string[]): Options {
    const optionTemplate: Options = {
        input: "",
        fontFile: "",
        output: "",
        fontSize: 20,
        watch: false,
        port: 8080,
        help: false,
        h: false,
    };

    try {
        const [options, files] = parseArguments(args, optionTemplate);

        if (options.help || options.h) {
            usage();
        }

        if (options.input === "") {
            if (files.length < 1) {
                usage("Expected input file argument");
            }
    
            options.input = files[0];
        }

        if (options.output.length === 0) {
            options.output = options.input.replace(
                new RegExp(`${extname(options.input)}$`),
                ".svg"
            );
        }
        return options;
    } catch (err) {
        usage(`${err}`);
    }
}

export async function main(args: string[]) {
    const options = parseArgs(args.slice(2));

    if (options.fontFile === "") {
        options.fontFile = findResource("fonts/inconsolata.regular.woff");
    }

    const skin = new Skin();
    const skinFile = findResource("symbols/skin.svg");
    await skin.load(skinFile);

    const symbols = await CoreSymbols.load("symbols/symbols.json");

    if (options.watch) {
        await watchAndRender(options, symbols, skin);
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
