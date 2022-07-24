import "source-map-support/register";

import { parse } from "./parser";
import { compile } from "./compiler";
import { render } from "./renderer";
import { CoreSymbols } from "./symbols";
import { Skin } from "./skin";
import { join } from "path";
import { readFile } from "fs/promises";

const skinFile = join(__dirname, "..", "Electrical_symbols_library.svg");

interface CommandLine {
    input: string;
}

function parseArgs(args: string[]): CommandLine {
    if (args.length < 3) {
        console.log("Expected koppla file argument");
        process.exit(1);
    }
    return {
        input: args[2]
    }
}

async function main(args: string[]) {
    const commandLine = parseArgs(args);
    const input = await readFile(commandLine.input);
    const parsed = parse(input.toString());

    const symbols = new CoreSymbols();
    const compiled = compile(parsed, symbols);
    
    const skin = new Skin();
    await skin.load(skinFile);
    const rendered = await render(compiled, symbols, skin, {optimize: true});
    console.log(rendered);
}

main(process.argv)
    .then(() => {
        //
    })
    .catch((err) => {
        console.log(err);
    });
