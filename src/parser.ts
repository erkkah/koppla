import { generate, Parser, SourceText } from "peggy";

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

export type Value = NumericValue | SymbolicValue;

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

type Statement = ConnectionStatement | Definition;

export type Schematic = Statement[];

export function createParser(): Parser {
    const grammar = `
    start = schematic
    schematic = (connection / part)+
    connection =
        source:(component / port)
        connections:(
            sourceTerminal:terminal? space wire space targetTerminal:terminal? target:(component / port) {
                return {
                    sourceTerminal,
                    target,
                    targetTerminal
                };
            }
        )* {
            return {
                type: "connection",
                source,
                connections: connections ?? []
            };
        }
    part = definition "\\n"
    port = "<" id:identifier spec:portspecifier? ">" {
        return {
            type: "port",
            identifier: id,
            specifier: spec
        };
    }
    portspecifier = ":" id: identifier {
        return id;
    }
    wire = "-"
    terminal = character / [+-]
    component = open:open space? definition:definition? space? close:close {
        return {
            type: "component",
            open,
            definition,
            close
        };
    }
    open "component start" = "[" / "|" / ">" / "(" / "$" / ":" / "/"
    close "component end" = "]" / "|" / "]" / ")" / "$" / ":" / "/"
    definition =
        designatorAndValue: (
            (
                designator:designator space? ":" space? value: value {
                    return {
                        designator,
                        value
                    };
                }
            )
            /
            (
                designator:designator {return {designator};}
                /
                value:value {return {value};}
            )
        )?
        space? symbol: ("!" id: identifier {return id;})?
        space? description: description?
        {
            return {
                type: "definition",
                ...designatorAndValue,
                symbol,
                description
            };
        }
    designator = designator:alpha index:integer {
        return {
            designator,
            index: parseInt(index, 10),
        };
    }
    value "value" = (value: decimal prefix: prefix? unit: unit? {
        return {
            type: "numericValue",
            value: parseFloat(value),
            prefix,
            unit
        };
    }) / (value: identifier {
        return {
            type: "symbolicValue",
            value
        };
    })
    identifier "identifier" = $(alpha+ (integer alpha?)*)
    description = quotedstring
    
    space "white space" = [ \\t]+
    alpha = $character+
    character = [a-z]i
    quotedstring = '"' chars:stringcharacter* '"' {return chars && chars.join("");}
    stringcharacter = char:[^\\\\"] {return char;} / "\\\\" '"' {return '"';}
    integer = $[0-9]+
    decimal = $[0-9.]+
    prefix = "p" / "n" / "u" / "m" / "k" / "M" / "G"
    unit = alpha
`;
    try {
        const parser = generate(grammar);
        return parser;
    } catch (err) {
        if ("format" in (err as Record<string, unknown>)) {
            const error = err as Formatter;
            throw error.format([
                {
                    source: undefined,
                    text: grammar,
                },
            ]);
        } else {
            throw err;
        }
    }
}

interface Formatter {
    format(sources: SourceText[]): string;
}

export function parse(source: string): Schematic {
    const parser = createParser();

    try {
        const parsed = parser.parse(source);
        return parsed as Schematic;
    } catch(err) {
        if (err instanceof parser.SyntaxError) {
            throw err.format([
                {
                    source: "input",
                    text: source,
                }
            ]);
        }
        throw err;
    }
}
