import { StyleCache } from "./css";
import { SymbolInfo } from "./symbols";
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
        rotationSteps?: number[] | undefined;
        dynamic?: boolean | undefined;
    } | undefined;
    constructor(svg: SVGNode, size: Point, terminals: Record<string, Point>, options?: {
        rotationSteps?: number[] | undefined;
        dynamic?: boolean | undefined;
    } | undefined);
    updateDynamicSize(size: Point): void;
    get svgData(): string;
}
export declare class Skin {
    private parsed;
    private cache;
    styleCache: StyleCache;
    static minimumBoxSize: Point;
    load(skinFile: string): Promise<void>;
    private dynamicSymbol;
    findSymbol(symbolInfo: SymbolInfo): SymbolSkin | undefined;
}
export {};
