import "source-map-support/register";

import { parse } from "./parser";
import { compile } from "./compiler";
import { render } from "./renderer";
import { CoreSymbols } from "./symbols";
import { Skin } from "./skin";
import { join } from "path";

const skinFile = join(__dirname, "..", "Electrical_symbols_library.svg");

async function main() {
    const symbols = new CoreSymbols();
    const source = `
    [R1] - [22k] [R1] - |4.7u|`;
    const parsed = parse(source);
    const compiled = compile(parsed, symbols);
    const skin = new Skin();
    await skin.load(skinFile);
    const rendered = await render(compiled, symbols, skin, {optimize: true});
    console.log(rendered);
}

main()
    .then(() => {
        //
    })
    .catch((err) => {
        console.log(err);
    });
