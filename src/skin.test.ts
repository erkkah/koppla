import assert from "assert";
import { join } from "path";
import { SVGPathData } from "svg-pathdata";
import { Skin } from "./skin";

const skinFile = join(__dirname, "..", "Electrical_symbols_library.svg");

async function loadSkin(): Promise<Skin> {
    const skin = new Skin();
    await skin.load(skinFile);
    return skin;
}

describe("Skin", () => {
    it("finds symbol", async () => {
        const skin = await loadSkin();
        const found = skin.findSymbol("resistor");
        expect(found).not.toBeNull();
    });

    it("strips symbols", async () => {
        const skin = await loadSkin();
        const found = skin.findSymbol("resistor");
        assert(found !== undefined);
        const attrs = found?.svg["@attrs"];
        expect(attrs["id"]).toBeUndefined();
        expect(attrs["transform"]).toBeUndefined();
    });


    it("parses pathdata ok", () => {
        const parsed = new SVGPathData("m 1037.75,710.41665 h 35");
        expect(parsed.commands).toHaveLength(2);
    });
});
