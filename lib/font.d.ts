import { Font } from "opentype.js";
export interface LoadedFont {
    font?: Font;
    dataURL?: string;
    width: number;
    height: number;
}
export declare function loadFontFromFile(path: string, size: number): Promise<LoadedFont>;
export declare function loadFontFromFont(font: Font, size: number): LoadedFont;
export declare function loadFont(path: string): Promise<Font>;
export declare function trimFont(font: Font, subset: string): Font;
export declare function defaultFont(size: number): LoadedFont;
