import assert from "assert";
import { join } from "path";
import { SVGPathData } from "svg-pathdata";
import { Skin } from "./skin";

const skinFile = join(__dirname, "..", "symbols", "library.svg");

async function loadSkin(): Promise<Skin> {
    const skin = new Skin();
    await skin.load(skinFile);
    return skin;
}

describe("Skin", () => {
    it("finds symbol", async () => {
        const skin = await loadSkin();
        const found = skin.findSymbol({
            ID: "resistor",
            terminals: [],
        });
        expect(found).not.toBeNull();
    });

    it("strips symbols", async () => {
        const skin = await loadSkin();
        const found = skin.findSymbol({
            ID: "resistor",
            terminals: [],
        });
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
