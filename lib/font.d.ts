export interface LoadedFont {
    dataURL?: string;
    width: number;
    height: number;
}
export declare function loadFontAsDataURL(path: string, size: number): Promise<LoadedFont>;
export declare function defaultFont(size: number): LoadedFont;
