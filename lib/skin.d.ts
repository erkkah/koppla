interface XMLNode extends Record<string, unknown> {
    "@attrs": Record<string, string | number | undefined>;
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
        d: number;
        cx: number;
        cy: number;
    };
}
interface SVGRect extends XMLNode {
    "@attrs": SVGElement["@attrs"] & {
        x: number;
        y: number;
        width: number;
        height: number;
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
export declare class SymbolSkin {
    readonly svg: SVGNode;
    readonly size: Point;
    constructor(svg: SVGNode, size: Point);
    get svgData(): string;
}
export declare class Skin {
    parsed: ParsedSVG | undefined;
    cache: Record<string, SymbolSkin | undefined>;
    load(skinFile: string): Promise<void>;
    findSymbol(symbol: string): SymbolSkin | undefined;
}
export {};
