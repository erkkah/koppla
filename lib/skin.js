"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Skin = exports.SymbolSkin = void 0;
const assert_1 = __importDefault(require("assert"));
const promises_1 = require("fs/promises");
const fast_xml_parser_1 = require("fast-xml-parser");
const svg_pathdata_1 = require("svg-pathdata");
class SymbolSkin {
    constructor(svg, size) {
        this.svg = svg;
        this.size = size;
    }
    get svgData() {
        const builder = new fast_xml_parser_1.XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: "",
            attributesGroupName: "@attrs",
            attributeValueProcessor: (name, value) => {
                if (["x", "y", "cx", "cy", "width", "height"].includes(name)) {
                    return String(Math.round(Number(value) * 1000) / 1000);
                }
                return value;
            },
        });
        return builder.build(this.svg);
    }
}
exports.SymbolSkin = SymbolSkin;
class Skin {
    constructor() {
        this.cache = {};
    }
    async load(skinFile) {
        const parser = new fast_xml_parser_1.XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "",
            attributesGroupName: "@attrs",
            ignoreDeclaration: true,
            isArray: (tagName) => ["g", "circle", "rect", "path"].includes(tagName),
        });
        const skinData = await (0, promises_1.readFile)(skinFile);
        this.parsed = parser.parse(skinData);
    }
    findSymbol(symbol) {
        (0, assert_1.default)(this.parsed !== undefined, "Must parse before accessing skin data");
        if (symbol in this.cache) {
            return this.cache[symbol];
        }
        const found = findNodeWithAttribute(this.parsed.svg, "koppla:symbol", symbol);
        let result = undefined;
        if (found !== undefined) {
            result = makeSymbolSkin(found);
        }
        this.cache[symbol] = result;
        return result;
    }
}
exports.Skin = Skin;
function makeSymbolSkin(svg) {
    const translated = translateAndStripSVG(svg);
    const bounds = getSVGBounds(translated);
    return new SymbolSkin(translated, bounds.max);
}
function translateAndStripSVG(svg) {
    var _a;
    const bounds = getSVGBounds(svg);
    svg["@attrs"] = {
        style: svg["@attrs"].style,
    };
    if (svg.path !== undefined) {
        for (const path of (_a = svg.path) !== null && _a !== void 0 ? _a : []) {
            const data = path["@attrs"].d;
            const pathData = new svg_pathdata_1.SVGPathData(data);
            const zeroBased = pathData.translate(-bounds.min.x, -bounds.min.y).round(1e3).commands;
            const attrs = path["@attrs"];
            path["@attrs"] = {
                style: attrs.style,
                d: (0, svg_pathdata_1.encodeSVGPath)(zeroBased),
            };
        }
    }
    if (svg.circle !== undefined) {
        for (const c of svg.circle) {
            const attrs = c["@attrs"];
            c["@attrs"] = {
                style: attrs.style,
                d: attrs.d,
                cx: attrs.cx - bounds.min.x,
                cy: attrs.cy - bounds.min.y,
            };
        }
    }
    if (svg.rect !== undefined) {
        for (const r of svg.rect) {
            const attrs = r["@attrs"];
            r["@attrs"] = {
                style: attrs.style,
                x: attrs.x - bounds.min.x,
                y: attrs.y - bounds.min.y,
                width: attrs.width,
                height: attrs.height,
            };
        }
    }
    if (svg.g !== undefined) {
        for (const i in svg.g) {
            const child = svg.g[i];
            if (child["@attrs"].transform !== undefined) {
                throw new Error("Group level transform is not supported");
            }
            const translated = translateAndStripSVG(child);
            svg.g[i] = translated;
        }
    }
    return svg;
}
function minPoint(a, b) {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
    };
}
function maxPoint(a, b) {
    return {
        x: Math.max(a.x, b.x),
        y: Math.max(a.y, b.y),
    };
}
function getSVGBounds(svg) {
    var _a;
    let min = { x: Number.MAX_VALUE, y: Number.MAX_VALUE };
    let max = { x: Number.MIN_VALUE, y: Number.MIN_VALUE };
    if (svg.path !== undefined) {
        for (const path of (_a = svg.path) !== null && _a !== void 0 ? _a : []) {
            const data = path["@attrs"].d;
            const pathData = new svg_pathdata_1.SVGPathData(data);
            const { minX, minY, maxX, maxY } = pathData.getBounds();
            min = minPoint(min, { x: minX, y: minY });
            max = maxPoint(max, { x: maxX, y: maxY });
        }
    }
    if (svg.circle !== undefined) {
        for (const c of svg.circle) {
            const attrs = c["@attrs"];
            const r = attrs.d / 2;
            const cMinX = attrs.cx - r;
            const cMinY = attrs.cy - r;
            const cMaxX = attrs.cx + r;
            const cMaxY = attrs.cy + r;
            min = minPoint(min, { x: cMinX, y: cMinY });
            max = maxPoint(max, { x: cMaxX, y: cMaxY });
        }
    }
    if (svg.g !== undefined) {
        for (const g of svg.g) {
            const bounds = getSVGBounds(g);
            min = minPoint(min, bounds.min);
            max = maxPoint(max, bounds.max);
        }
    }
    return { min, max };
}
function findNodeWithAttribute(start, attribute, value) {
    if (start["@attrs"][attribute] === value) {
        return start;
    }
    const scanChildren = (children) => {
        if (children !== undefined) {
            if (!Array.isArray(children)) {
                children = [children];
            }
            for (const child of children) {
                const found = findNodeWithAttribute(child, attribute, value);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    };
    return scanChildren(start.g) || scanChildren(start.path);
}
//# sourceMappingURL=skin.js.map