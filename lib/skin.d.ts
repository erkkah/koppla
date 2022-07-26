import { StyleCache } from "./css";
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
        d?: string;
        r?: string;
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
export interface Point {
    x: number;
    y: number;
}
export declare class SymbolSkin {
    readonly svg: SVGNode;
    readonly size: Point;
    readonly terminals: Record<string, Point>;
    readonly options?: {
        rotationSteps?: number | undefined;
        scale?: number | undefined;
    } | undefined;
    constructor(svg: SVGNode, size: Point, terminals: Record<string, Point>, options?: {
        rotationSteps?: number | undefined;
        scale?: number | undefined;
    } | undefined);
    get svgData(): string;
}
export declare class Skin {
    private parsed;
    private cache;
    styleCache: StyleCache;
    load(skinFile: string): Promise<void>;
    findSymbol(symbol: string): SymbolSkin | undefined;
}
export {};
