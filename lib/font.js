"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultFont = exports.trimFont = exports.loadFont = exports.loadFontFromFont = exports.loadFontFromFile = void 0;
const promises_1 = require("fs/promises");
const opentype_js_1 = require("opentype.js");
async function loadFontFromFile(path, size) {
    const fileData = await (0, promises_1.readFile)(path);
    const font = (0, opentype_js_1.parse)(fileData.buffer);
    return loadFontFromFont(font, size);
}
exports.loadFontFromFile = loadFontFromFile;
function loadFontFromFont(font, size) {
    const firstGlyph = font.glyphs.get(0);
    const firstChar = String.fromCharCode(firstGlyph.unicode);
    const charWidth = font.getAdvanceWidth(firstChar, size);
    const fontData = Buffer.from(font.toArrayBuffer());
    const encoded = fontData.toString("base64");
    return {
        font,
        dataURL: `data:application/octet-stream;base64,${encoded}`,
        width: charWidth,
        height: size,
    };
}
exports.loadFontFromFont = loadFontFromFont;
async function loadFont(path) {
    const fileData = await (0, promises_1.readFile)(path);
    const font = (0, opentype_js_1.parse)(fileData.buffer);
    return font;
}
exports.loadFont = loadFont;
function trimFont(font, subset) {
    const glyphs = [];
    // x is always used for measuring above
    if (!subset.includes("x")) {
        subset += "x";
    }
    for (const char of subset) {
        const found = font.charToGlyph(char);
        glyphs.push(found);
    }
    return new opentype_js_1.Font({
        ascender: font.ascender,
        descender: font.descender,
        familyName: font.names.fontFamily.en,
        glyphs,
        styleName: font.names.fontSubfamily.en,
        unitsPerEm: font.unitsPerEm,
    });
}
exports.trimFont = trimFont;
function defaultFont(size) {
    return {
        width: size / 2,
        height: size,
    };
}
exports.defaultFont = defaultFont;
//# sourceMappingURL=font.js.map