"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultFont = exports.loadFontAsDataURL = void 0;
const promises_1 = require("fs/promises");
const opentype_js_1 = require("opentype.js");
async function loadFontAsDataURL(path, size) {
    const fileData = await (0, promises_1.readFile)(path);
    const font = (0, opentype_js_1.parse)(fileData.buffer);
    const xWidth = font.getAdvanceWidth("x", size);
    for (const c of "XiyZÅ0|") {
        const width = font.getAdvanceWidth(c, size);
        if (width != xWidth) {
            throw new Error("Only monospaced fonts are supported");
        }
    }
    const encoded = fileData.toString("base64");
    return {
        dataURL: `data:application/octet-stream;base64,${encoded}`,
        width: xWidth,
        height: size,
    };
}
exports.loadFontAsDataURL = loadFontAsDataURL;
function defaultFont(size) {
    return {
        width: size / 2,
        height: size,
    };
}
exports.defaultFont = defaultFont;
//# sourceMappingURL=font.js.map