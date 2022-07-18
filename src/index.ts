import { parse } from "./parser";
import { compile } from "./compiler";
import { render } from "./renderer";

async function main() {
    const source = `
    [R1] - [22k]`;
    const parsed = parse(source);
    const compiled = compile(parsed);
    const rendered = await render(compiled);
    console.log(rendered);
}

main()
    .then(() => {
        //
    })
    .catch((err) => {
        console.log(err);
    });
