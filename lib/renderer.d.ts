import { Node as ELKNode } from "elkjs";
import { CompiledSchematic, CompiledNode } from "./compiler";
import { Skin, SymbolSkin } from "./skin";
declare type KopplaELKNode = ELKNode & {
    koppla: {
        node: CompiledNode;
        skin?: SymbolSkin;
        rotation: number;
    };
};
declare type KopplaELKRoot = Omit<ELKNode, "children" | "edges"> & Pick<Required<ELKNode>, "edges"> & {
    children: KopplaELKNode[];
};
export declare function render(schematic: CompiledSchematic, skin: Skin, options?: {
    optimize: boolean;
    fontFile?: string;
    fontSize: number;
}): Promise<string>;
export declare function optimize(root: KopplaELKRoot, preprocessed: KopplaELKRoot): KopplaELKRoot;
export {};
