import { readFile } from "fs/promises";
import {parse} from "opentype.js";

export interface LoadedFont {
    dataURL?: string;
    width: number;
    height: number;
}

export async function loadFontAsDataURL(path: string, size: number): Promise<LoadedFont> {
    const fileData = await readFile(path);
    const font = parse(fileData.buffer);
    
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

export function defaultFont(size: number): LoadedFont {
    return {
        width: size / 2, // "best" guess
        height: size,
    }
}
