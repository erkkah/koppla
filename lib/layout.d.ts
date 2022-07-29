import { Node as ELKNode } from "elkjs";
import { CompiledNode, CompiledSchematic } from "./compiler";
import { LoadedFont } from "./font";
import { Skin, SymbolSkin } from "./skin";
export declare type KopplaELKNode = ELKNode & {
    koppla: {
        node: CompiledNode;
        skin?: SymbolSkin;
        rotation: number;
    };
};
export declare type KopplaELKRoot = Omit<ELKNode, "children" | "edges"> & Pick<Required<ELKNode>, "edges"> & {
    children: KopplaELKNode[];
};
export declare function layout(schematic: CompiledSchematic, skin: Skin, font: LoadedFont, options?: {
    optimize: boolean;
}): Promise<ELKNode>;
