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
const css_1 = require("./css");
class SymbolSkin {
    constructor(svg, size, terminals, options) {
        this.svg = svg;
        this.size = size;
        this.terminals = terminals;
        this.options = options;
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
        this.styleCache = new css_1.StyleCache("kpl");
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
            try {
                result = makeSymbolSkin(found, this.styleCache);
            }
            catch (err) {
                throw new Error(`Failed to load symbol "${symbol}": ${err}`);
            }
        }
        this.cache[symbol] = result;
        return result;
    }
}
exports.Skin = Skin;
function makeSymbolSkin(svg, styleCache) {
    const initialBounds = getSVGBounds(svg);
    const rotations = extractRotations(svg);
    const translated = translateAndStripSVG(svg, initialBounds);
    const bounds = getSVGBounds(translated);
    const terminals = extractTerminals(translated, bounds.max);
    stylesToClass(translated, styleCache);
    return new SymbolSkin(translated, bounds.max, terminals, {
        rotationSteps: rotations,
    });
}
function stylesToClass(svg, styleCache) {
    const style = pluckAttribute(svg, "style");
    if (style !== undefined) {
        svg["@attrs"].class = styleCache.styleToClass(style);
    }
    const convert = (svgs) => {
        for (const s of svgs !== null && svgs !== void 0 ? svgs : []) {
            stylesToClass(s, styleCache);
        }
    };
    convert(svg.circle);
    convert(svg.path);
    convert(svg.rect);
    convert(svg.g);
}
function getPathEnd(commands) {
    (0, assert_1.default)(commands.length >= 1);
    const last = commands[commands.length - 1];
    (0, assert_1.default)(last.type === svg_pathdata_1.SVGPathData.MOVE_TO ||
        last.type === svg_pathdata_1.SVGPathData.LINE_TO ||
        last.type === svg_pathdata_1.SVGPathData.HORIZ_LINE_TO ||
        last.type === svg_pathdata_1.SVGPathData.VERT_LINE_TO);
    switch (last.type) {
        case svg_pathdata_1.SVGPathData.MOVE_TO:
        case svg_pathdata_1.SVGPathData.LINE_TO: {
            const { x, y } = last;
            return { x, y };
        }
        case svg_pathdata_1.SVGPathData.HORIZ_LINE_TO: {
            const previousEnd = getPathEnd(commands.slice(0, commands.length - 1));
            const { x } = last;
            const { y } = previousEnd;
            return { x, y };
        }
        case svg_pathdata_1.SVGPathData.VERT_LINE_TO: {
            const previousEnd = getPathEnd(commands.slice(0, commands.length - 1));
            const { y } = last;
            const { x } = previousEnd;
            return { x, y };
        }
    }
}
function getPathSegmentCandidates(path) {
    (0, assert_1.default)(path.commands.length >= 2);
    const abs = path.sanitize().toAbs();
    const first = abs.commands[0];
    (0, assert_1.default)(first.type === svg_pathdata_1.SVGPathData.MOVE_TO);
    const { x: startX1, y: startY1 } = first;
    const { x: startX2, y: startY2 } = getPathEnd(abs.commands.slice(0, 2));
    const { x: endX1, y: endY1 } = getPathEnd(abs.commands.slice(0, abs.commands.length - 1));
    const { x: endX2, y: endY2 } = getPathEnd(abs.commands);
    const candidates = [];
    if (startX1 === startX2 || startY1 === startY2) {
        // Only straight lines
        candidates.push({
            x1: startX1,
            y1: startY1,
            x2: startX2,
            y2: startY2,
        });
    }
    if ((endX1 === endX2 || endY1 === endY2) &&
        (startX1 !== endX1 ||
            startY1 !== endY1 ||
            startX2 !== endX2 ||
            startY2 !== endY2)) {
        candidates.push({
            x1: endX1,
            y1: endY1,
            x2: endX2,
            y2: endY2,
        });
    }
    return candidates;
}
function extractRotations(svg) {
    const rotationAttribute = pluckAttribute(svg, "koppla:rotations");
    if (rotationAttribute !== undefined) {
        return rotationAttribute.split(",").map((rotationString) => {
            const rotation = Number(rotationString.trim());
            if (!Number.isInteger(rotation) || rotation < 0 || rotation > 3) {
                throw new Error(`Invalid symbol rotation ${rotation}, should be an integer in range [0,3]`);
            }
            return rotation;
        });
    }
    return undefined;
}
function extractTerminals(svg, size) {
    const terminalPaths = findTerminalPaths(svg);
    const terminalPoints = terminalPaths.map((path) => {
        const pathData = new svg_pathdata_1.SVGPathData(path["@attrs"].d);
        const terminal = pluckAttribute(path, "koppla:terminal");
        if (terminal === undefined) {
            return {};
        }
        (0, assert_1.default)(typeof terminal === "string");
        const segments = getPathSegmentCandidates(pathData);
        for (const segment of segments) {
            if (segment.x1 === segment.x2) {
                // vertical line
                const minY = Math.min(segment.y1, segment.y2);
                const maxY = Math.max(segment.y1, segment.y2);
                if (minY === 0) {
                    return {
                        [terminal]: { x: segment.x1, y: 0 }
                    };
                }
                if (maxY === size.y) {
                    return {
                        [terminal]: { x: segment.x1, y: maxY }
                    };
                }
            }
            else {
                (0, assert_1.default)(segment.y1 === segment.y2);
                // horizontal line
                const minX = Math.min(segment.x1, segment.x2);
                const maxX = Math.max(segment.x1, segment.x2);
                if (minX === 0) {
                    return {
                        [terminal]: { x: 0, y: segment.y1 }
                    };
                }
                if (maxX === size.x) {
                    return {
                        [terminal]: { x: maxX, y: segment.y1 }
                    };
                }
            }
        }
        throw new Error(`Unexpected terminal bounds for terminal ${terminal}`);
    });
    return terminalPoints.reduce((map, point) => {
        return Object.assign(Object.assign({}, map), point);
    }, {});
}
/**
 * Returns an origin - translated node, optionally with its content centered in a square bounding box.
 * Strips unneeded attributes in the process.
 */
function translateAndStripSVG(svg, bounds, options = { makeSquare: false }) {
    var _a;
    svg["@attrs"] = {
        style: svg["@attrs"].style,
    };
    let xAdjust = -bounds.min.x;
    let yAdjust = -bounds.min.y;
    if (options.makeSquare) {
        const width = bounds.max.x - bounds.min.x;
        const height = bounds.max.y - bounds.min.y;
        const landscape = width > height;
        xAdjust = landscape
            ? -bounds.min.x
            : -bounds.min.x + (height - width) / 2;
        yAdjust = landscape
            ? -bounds.min.y + (width - height) / 2
            : -bounds.min.y;
    }
    if (svg.path !== undefined) {
        for (const path of (_a = svg.path) !== null && _a !== void 0 ? _a : []) {
            const data = path["@attrs"].d;
            const pathData = new svg_pathdata_1.SVGPathData(data);
            const zeroBased = pathData
                .translate(xAdjust, yAdjust)
                .round(1e3).commands;
            const attrs = path["@attrs"];
            const terminal = attrs["koppla:terminal"];
            path["@attrs"] = {
                style: attrs.style,
                d: (0, svg_pathdata_1.encodeSVGPath)(zeroBased),
            };
            if (terminal !== undefined) {
                path["@attrs"]["koppla:terminal"] = terminal;
            }
        }
    }
    if (svg.circle !== undefined) {
        for (const c of svg.circle) {
            const attrs = c["@attrs"];
            const cx = String(Number(attrs.cx) + xAdjust);
            const cy = String(Number(attrs.cy) + yAdjust);
            c["@attrs"] = {
                style: attrs.style,
                r: attrs.r,
                cx,
                cy,
            };
        }
    }
    if (svg.rect !== undefined) {
        for (const r of svg.rect) {
            const attrs = r["@attrs"];
            const x = String(Number(attrs.x) + xAdjust);
            const y = String(Number(attrs.y) + yAdjust);
            r["@attrs"] = {
                style: attrs.style,
                x,
                y,
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
            const translated = translateAndStripSVG(child, bounds);
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
    let max = { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE };
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
            const r = "r" in attrs ? Number(attrs.r) : Number(attrs.d) / 2;
            const cx = Number(attrs.cx);
            const cy = Number(attrs.cy);
            const cMinX = cx - r;
            const cMinY = cy - r;
            const cMaxX = cx + r;
            const cMaxY = cy + r;
            min = minPoint(min, { x: cMinX, y: cMinY });
            max = maxPoint(max, { x: cMaxX, y: cMaxY });
        }
    }
    if (svg.rect !== undefined) {
        for (const r of svg.rect) {
            const attrs = r["@attrs"];
            const x = Number(attrs.x);
            const y = Number(attrs.y);
            const width = Number(attrs.width);
            const height = Number(attrs.height);
            min = minPoint(min, { x, y });
            max = maxPoint(max, { x: x + width, y: y + height });
        }
    }
    if (svg.g !== undefined) {
        for (const g of svg.g) {
            const bounds = getSVGBounds(g);
            min = minPoint(min, bounds.min);
            max = maxPoint(max, bounds.max);
        }
    }
    try {
        (0, assert_1.default)(Number.isFinite(min.x));
        (0, assert_1.default)(Number.isFinite(min.y));
        (0, assert_1.default)(Number.isFinite(max.x));
        (0, assert_1.default)(Number.isFinite(max.y));
        return { min, max };
    }
    catch (err) {
        throw err;
    }
}
function pluckAttribute(svg, attribute) {
    const value = svg["@attrs"][attribute];
    delete svg["@attrs"][attribute];
    return value;
}
function findNodeWithAttribute(start, attribute, value) {
    if (start["@attrs"][attribute] === value) {
        return start;
    }
    const scanChildren = (children) => {
        if (children !== undefined) {
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
function findTerminalPaths(start) {
    var _a, _b;
    const paths = ((_a = start.path) !== null && _a !== void 0 ? _a : []).filter((path) => path["@attrs"]["koppla:terminal"] !== undefined);
    const childPaths = ((_b = start.g) !== null && _b !== void 0 ? _b : []).flatMap((node) => {
        return findTerminalPaths(node);
    });
    return [...paths, ...childPaths];
}
//# sourceMappingURL=skin.js.map