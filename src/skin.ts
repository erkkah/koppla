import assert from "assert";
import { readFile } from "fs/promises";
import { XMLBuilder, XMLParser } from "fast-xml-parser";
import { encodeSVGPath, SVGPathData } from "svg-pathdata";

interface XMLNode extends Record<string, unknown> {
    "@attrs": Record<string, string | undefined>;
}

interface SVGElement extends XMLNode {
    "@attrs": XMLNode["@attrs"] & {
        id?: string;
        style?: string;
    };
}

interface SVGPath extends SVGElement {
    "@attrs": SVGElement["@attrs"] & {
        d: string;
    };
}

interface SVGCircle extends XMLNode {
    "@attrs": SVGElement["@attrs"] & {
        d: string;
        cx: string;
        cy: string;
    };
}

interface SVGRect extends XMLNode {
    "@attrs": SVGElement["@attrs"] & {
        x: string;
        y: string;
        width: string;
        height: string;
    };
}

interface SVGNode extends XMLNode {
    g?: SVGNode[];
    path?: SVGPath[];
    circle?: SVGCircle[];
    rect?: SVGRect[];
}

interface ParsedSVG {
    svg: SVGNode;
}

interface Point {
    x: number;
    y: number;
}

export class SymbolSkin {
    constructor(
        readonly svg: SVGNode,
        readonly size: Point,
        readonly terminals: Record<string, Point>
    ) {}

    get svgData(): string {
        const builder = new XMLBuilder({
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

export class Skin {
    parsed: ParsedSVG | undefined;
    cache: Record<string, SymbolSkin | undefined> = {};

    async load(skinFile: string) {
        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: "",
            attributesGroupName: "@attrs",
            ignoreDeclaration: true,
            isArray: (tagName) =>
                ["g", "circle", "rect", "path"].includes(tagName),
        });
        const skinData = await readFile(skinFile);
        this.parsed = parser.parse(skinData);
    }

    findSymbol(symbol: string): SymbolSkin | undefined {
        assert(
            this.parsed !== undefined,
            "Must parse before accessing skin data"
        );

        if (symbol in this.cache) {
            return this.cache[symbol];
        }

        const found = findNodeWithAttribute(
            this.parsed.svg,
            "koppla:symbol",
            symbol
        );

        let result: SymbolSkin | undefined = undefined;

        if (found !== undefined) {
            result = makeSymbolSkin(found);
        }

        this.cache[symbol] = result;
        return result;
    }
}

function makeSymbolSkin(svg: SVGNode): SymbolSkin {
    const translated = translateAndStripSVG(svg);
    const bounds = getSVGBounds(translated);
    const terminals = extractTerminals(translated, bounds.max);

    return new SymbolSkin(translated, bounds.max, terminals);
}

function extractTerminals(svg: SVGNode, size: Point): Record<string, Point> {
    const terminalPaths = findTerminalPaths(svg);
    const terminalPoints = terminalPaths.map((path) => {
        const pathData = new SVGPathData(path["@attrs"].d);
        const terminal = path["@attrs"]["koppla:terminal"];
        assert(typeof terminal === "string");
        delete path["@attrs"]["koppla:terminal"];

        const bounds = pathData.getBounds();
        if (bounds.minX === bounds.maxX) {
            // vertical connector

            if (bounds.minY < size.y / 2) {
                // top connector

                return {
                    [terminal]: { x: bounds.minX, y: bounds.minY },
                };
            } else {
                // bottom connector

                return {
                    [terminal]: { x: bounds.minX, y: bounds.maxY },
                };
            }
        } else {
            assert(bounds.minY === bounds.maxY);
            // horizontal connector

            if (bounds.minX < size.x / 2) {
                // left connector

                return {
                    [terminal]: { x: bounds.minX, y: bounds.minY },
                };
            } else {
                // right connector

                return {
                    [terminal]: { x: bounds.maxX, y: bounds.minY },
                };
            }
        }
    });
    return terminalPoints.reduce((map, point) => {
        return {
            ...map,
            ...point,
        };
    }, {});
}

function translateAndStripSVG(svg: SVGNode): SVGNode {
    const bounds = getSVGBounds(svg);

    svg["@attrs"] = {
        style: svg["@attrs"].style,
    };

    if (svg.path !== undefined) {
        for (const path of svg.path ?? []) {
            const data = path["@attrs"].d;
            const pathData = new SVGPathData(data);
            const zeroBased = pathData
                .translate(-bounds.min.x, -bounds.min.y)
                .round(1e3).commands;
            const attrs = path["@attrs"];
            path["@attrs"] = {
                style: attrs.style,
                "koppla:terminal": attrs["koppla:terminal"],
                d: encodeSVGPath(zeroBased),
            };
        }
    }

    if (svg.circle !== undefined) {
        for (const c of svg.circle) {
            const attrs = c["@attrs"];
            const cx = String(Number(attrs.cx) - bounds.min.x);
            const cy = String(Number(attrs.cy) - bounds.min.y);
            c["@attrs"] = {
                style: attrs.style,
                d: attrs.d,
                cx,
                cy,
            };
        }
    }

    if (svg.rect !== undefined) {
        for (const r of svg.rect) {
            const attrs = r["@attrs"];
            const x = String(Number(attrs.x) - bounds.min.x);
            const y = String(Number(attrs.y) - bounds.min.y);

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
            const translated = translateAndStripSVG(child);
            svg.g[i] = translated;
        }
    }

    return svg;
}

function minPoint(a: Point, b: Point): Point {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
    };
}

function maxPoint(a: Point, b: Point): Point {
    return {
        x: Math.max(a.x, b.x),
        y: Math.max(a.y, b.y),
    };
}

function getSVGBounds(svg: SVGNode): { min: Point; max: Point } {
    let min: Point = { x: Number.MAX_VALUE, y: Number.MAX_VALUE };
    let max: Point = { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE };

    if (svg.path !== undefined) {
        for (const path of svg.path ?? []) {
            const data = path["@attrs"].d;
            const pathData = new SVGPathData(data);
            const { minX, minY, maxX, maxY } = pathData.getBounds();
            min = minPoint(min, { x: minX, y: minY });
            max = maxPoint(max, { x: maxX, y: maxY });
        }
    }

    if (svg.circle !== undefined) {
        for (const c of svg.circle) {
            const attrs = c["@attrs"];
            const r = Number(attrs.d) / 2;
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
            min = minPoint(min, {x, y});
            max = maxPoint(max, {x: x + width, y: y + height});
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

function findNodeWithAttribute(
    start: SVGNode,
    attribute: string,
    value: string
): SVGNode | undefined {
    if (start["@attrs"][attribute] === value) {
        return start;
    }

    const scanChildren = (children?: SVGNode[]) => {
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

function findTerminalPaths(start: SVGNode): SVGPath[] {
    const paths = (start.path ?? []).filter(
        (path) => "koppla:terminal" in path["@attrs"]
    );

    const childPaths = (start.g ?? []).flatMap<SVGPath>((node) => {
        return findTerminalPaths(node);
    });

    return [...paths, ...childPaths];
}
