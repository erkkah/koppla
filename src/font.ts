import { readFile } from "fs/promises";
import { Font, Glyph, parse, Path } from "opentype.js";

export interface LoadedFont {
    font?: Font;
    dataURL?: string;
    width: number;
    height: number;
}

export async function loadFontFromFile(
    path: string,
    size: number
): Promise<LoadedFont> {
    const fileData = await readFile(path);
    const font = parse(fileData.buffer);

    return loadFontFromFont(font, size);
}

export function loadFontFromFont(font: Font, size: number): LoadedFont {
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

export async function loadFont(path: string): Promise<Font> {
    const fileData = await readFile(path);
    const font = parse(fileData.buffer);
    return font;
}

export function trimFont(font: Font, subset: string): Font {
    const notdefGlyph = new Glyph({
        name: '.notdef',
        unicode: 0,
        advanceWidth: 650,
        path: new Path()
    });

    const glyphs: Glyph[] = [
        notdefGlyph
    ];

    // x is always used for measuring above
    if (!subset.includes("x")) {
        subset += "x";
    }
    for (const char of subset) {
        const found = font.charToGlyph(char);
        glyphs.push(found);
    }
    return new Font({
        ascender: font.ascender,
        descender: font.descender,
        familyName: font.names.fontFamily.en,
        glyphs,
        styleName: font.names.fontSubfamily.en,
        unitsPerEm: font.unitsPerEm,
    });
}

export function defaultFont(size: number): LoadedFont {
    return {
        width: size / 2, // "best" guess
        height: size,
    };
}
