import { Parser } from "peggy";
interface NumericValue {
    type: "numericValue";
    value: number;
    prefix: string;
    unit: string;
}
interface SymbolicValue {
    type: "symbolicValue";
    value: string;
}
export declare type Value = NumericValue | SymbolicValue;
export interface Definition {
    type: "definition";
    designator?: {
        designator: string;
        index: number;
    };
    value?: Value;
    symbol?: string;
    description?: string;
}
interface Component {
    type: "component";
    open: string;
    definition: Definition;
    close: string;
}
interface Port {
    type: "port";
    identifier: "in" | "out" | "gnd" | "v";
    specifier?: string;
}
interface Connection {
    sourceTerminal?: string;
    target: Component | Port;
    targetTerminal?: string;
}
interface ConnectionStatement {
    type: "connection";
    source: Component | Port;
    connections: Connection[];
}
declare type Statement = ConnectionStatement | Definition;
export declare type Schematic = Statement[];
export declare function createParser(): Parser;
export declare function parse(source: string): Schematic;
export {};
