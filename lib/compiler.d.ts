import { Schematic, Definition, Port, Value, Settings, SourceLocation, TypedValue } from "./parser";
import { SymbolInfo, SymbolLibrary } from "./symbols";
interface NodeID {
    ID: string;
    resolved: boolean;
}
declare type CompiledDefinition = Pick<Definition, "description" | "symbol" | "value" | "location"> & Required<Pick<Definition, "designator">>;
interface CompiledConnection {
    source: NodeID;
    target: NodeID;
    sourceTerminal?: string;
    targetTerminal?: string;
    sourceFlipped?: boolean;
    targetFlipped?: boolean;
    location: SourceLocation;
}
export interface CompiledNode {
    ID: string;
    designator: string;
    symbol: string;
    description?: string;
    value?: Value;
    location: SourceLocation;
    symbolInfo?: SymbolInfo;
}
export declare class CompiledSchematic {
    private ports;
    private components;
    private connections;
    readonly settings: Record<string, TypedValue>;
    private unresolvedIndex;
    private resolved;
    private getNodes;
    get nodes(): CompiledNode[];
    get edges(): Required<CompiledConnection>[];
    component(definition: CompiledDefinition): NodeID;
    port(port: Port): NodeID;
    connection(connection: CompiledConnection): void;
    settingsList(settings: Settings["settings"]): void;
    resolve(symbols: SymbolLibrary): void;
}
export declare function compile(schematic: Schematic, symbols: SymbolLibrary): CompiledSchematic;
export {};
