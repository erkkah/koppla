import { CompiledSchematic } from "./compiler";
import { Skin } from "./skin";
import { SymbolLibrary } from "./symbols";
export declare function render(schematic: CompiledSchematic, symbols: SymbolLibrary, skin: Skin): Promise<string>;
