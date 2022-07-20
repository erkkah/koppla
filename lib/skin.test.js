"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const path_1 = require("path");
const skin_1 = require("./skin");
const skinFile = (0, path_1.join)(__dirname, "..", "Electrical_symbols_library.svg");
async function loadSkin() {
    const skin = new skin_1.Skin();
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
        (0, assert_1.default)(found !== undefined);
        const attrs = found === null || found === void 0 ? void 0 : found.svg["@attrs"];
        expect(attrs["id"]).toBeUndefined();
        expect(attrs["transform"]).toBeUndefined();
    });
});
//# sourceMappingURL=skin.test.js.map