import { CompiledSchematic } from "./compiler";
import { Skin } from "./skin";
export interface RenderOptions {
    optimize: boolean;
    fontFile?: string;
    fontSize: number;
}
export declare function render(schematic: CompiledSchematic, skin: Skin, options?: RenderOptions): Promise<string>;
