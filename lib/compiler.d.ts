import { Schematic, Definition, Port, Value, Settings } from "./parser";
import { SymbolLibrary } from "./symbols";
interface NodeID {
    ID: string;
    resolved: boolean;
}
declare type CompiledDefinition = Pick<Definition, "description" | "symbol" | "value"> & Required<Pick<Definition, "designator">>;
interface CompiledConnection {
    source: NodeID;
    target: NodeID;
    sourceTerminal?: string;
    targetTerminal?: string;
    sourceFlipped?: boolean;
    targetFlipped?: boolean;
}
export interface CompiledNode {
    ID: string;
    designator: string;
    symbol: string;
    description?: string;
    value?: Value;
}
export declare class CompiledSchematic {
    private ports;
    private components;
    private connections;
    readonly settings: Record<string, string>;
    private unresolvedIndex;
    private resolved;
    private getNodes;
    get nodes(): CompiledNode[];
    get edges(): Required<CompiledConnection>[];
    component(definition: CompiledDefinition): NodeID;
    port(port: Port): NodeID;
    connection(source: NodeID, target: NodeID, sourceTerminal?: string, targetTerminal?: string, sourceFlipped?: boolean, targetFlipped?: boolean): void;
    settingsList(settings: Settings["settings"]): void;
    resolve(symbols: SymbolLibrary): void;
}
export declare function compile(schematic: Schematic, symbols: SymbolLibrary): CompiledSchematic;
export {};
