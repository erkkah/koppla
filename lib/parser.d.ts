import { Parser } from "peggy";
export interface NumericValue {
    type: "NumericValue";
    value: string;
    prefix: string;
    unit: string;
}
export interface SymbolicValue {
    type: "SymbolicValue";
    value: string;
}
export declare type Value = NumericValue | SymbolicValue;
export interface Definition {
    type: "Definition";
    designator?: {
        designator: string;
        index: number;
    };
    value?: Value;
    symbol?: string;
    description?: string;
}
export interface Component {
    type: "Component";
    open: string;
    definition: Definition;
    close: string;
}
export interface Port {
    type: "Port";
    identifier: "in" | "out" | "gnd" | "v";
    specifier?: string;
}
export declare type Node = Component | Port;
interface Connection {
    sourceTerminal?: string;
    target: Node;
    targetTerminal?: string;
}
export interface ConnectionStatement {
    type: "Connection";
    source: Node;
    connections: Connection[];
}
export declare type Statement = ConnectionStatement | Definition;
export interface Schematic {
    type: "Schematic";
    body: Statement[];
}
export declare function createParser(): Parser;
export declare function parse(source: string): Schematic;
export {};
