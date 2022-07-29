import { CompiledSchematic } from "./compiler";
import { Skin } from "./skin";
export declare function render(schematic: CompiledSchematic, skin: Skin, options?: {
    optimize: boolean;
    fontFile?: string;
    fontSize: number;
}): Promise<string>;
