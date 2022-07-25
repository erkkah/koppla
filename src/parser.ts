import { generate, Parser, SourceText } from "peggy";

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

export type Value = NumericValue | SymbolicValue;

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

export type Node = Component | Port;

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

export type Statement = ConnectionStatement | Definition;

export interface Schematic {
    type: "Schematic";
    body: Statement[];
}

function inArray(wanted: unknown, valid: string[]): boolean {
    return valid.findIndex((x) => x === wanted) >= 0;
}

function validComponentDelimiters(start: string, end: string): boolean {
    switch (start) {
        case "[":
            return inArray(end, ["]", "|"]);
        case "|":
            return inArray(end, ["|", "]"]);
        case ">":
            return inArray(end, ["|", "]", "/"]);
        case "(":
            return end === ")";
        case "$":
            return end === "$";
        case "*":
            return end === "*";
        case "/":
            return end === "/";
        default:
            return false;
    }
}

export function createParser(): Parser {
    const grammar = `
    {{
        ${inArray.toString()}
        ${validComponentDelimiters.toString()}

        function extractList(list, index) {
            return list.map(function(element) { return element[index]; });
        }

        function buildList(head, tail, index) {
            return [head].concat(extractList(tail, index));
        }

        function optionalList(value) {
            return value !== null ? value : [];
        }
    }}

    Start = WSC schematic:Schematic WSC EOF? {
        return schematic;
    }

    Schematic = body:Elements? {
        return {
            type: "Schematic",
            body: optionalList(body)
        }
    }

    Elements = head:Element tail:(WSC Element)* {
        return buildList(head, tail, 1);
    }

    Element = Connection / Part

    WSC = (WhiteSpace / Comment)*

    WhiteSpace "whitespace" = [ \\t\\r\\n]

    EOL = [\\n\\r]

    EOF = !.

    Comment "comment" = MultiLineComment / SingleLineComment
    MultiLineComment = CommentStart (!CommentEnd .)* CommentEnd
    CommentStart "comment start" = "#*"
    CommentEnd "comment end" = "*#"
    SingleLineComment = "#" (!EOL .)*

    Connection "connection" =
        source:(Component / Port)
        connections:(
            sourceTerminal:Terminal? Space Wire Space targetTerminal:Terminal? target:(Component / Port) {
                return {
                    sourceTerminal,
                    target,
                    targetTerminal
                };
            }
        )* {
            return {
                type: "Connection",
                source,
                connections: connections ?? []
            };
        }
    Part = definition:PartDefinition {
        return definition;
    }
    Port "port" = "<" id:Identifier spec:PortSpecifier? ">" {
        return {
            type: "Port",
            identifier: id,
            specifier: spec
        };
    }
    PortSpecifier = ":" id:Identifier {
        return id;
    }
    Wire = "-"
    Terminal "terminal" = Character / [+-]
    Component = open:Open WSC definition:Definition? WSC close:Close {
        if (!validComponentDelimiters(open, close)) {
            error("Invalid component");
        }
        return {
            type: "Component",
            open,
            definition,
            close
        };
    }
    Open "component start" = "[" / "|" / ">" / "(" / "$" / "*" / "/"
    Close "component end" = "]" / "|" / "<" / ")" / "$" / "*" / "/"
    PartDefinition =
        designator: Designator
        WSC
        value: Value?
        WSC
        symbolAndDescription: SymbolAndDescription {
            return {
                type: "Definition",
                designator,
                value,
                ...symbolAndDescription
            };            
        }
    Definition =
        designatorAndValue: DesignatorAndValue?
        WSC
        symbolAndDescription: SymbolAndDescription
        {
            return {
                type: "Definition",
                ...designatorAndValue,
                ...symbolAndDescription
            };
        }
    DesignatorAndValue =
        (
            designator:Designator WSC ":" WSC value: Value {
                return {
                    designator,
                    value
                };
            }
        )
        /
        (
            designator:Designator {return {designator};}
            /
            value:Value {return {value};}
        )
    SymbolAndDescription = 
        symbol: Symbol?
        WSC
        description: Description?
        {
            return {
                symbol,
                description
            };
        }
    Symbol "symbol" = "!" id:Identifier {return id;}
    Designator "designator" = (WSC designator:Alpha index:Integer {
        return {
            designator,
            index: parseInt(index, 10),
        };
    }) / (designator: ("GND"i / "IN"i / "OUT"i) {
        return {
            designator,
            index: 0,
        }
    })
    Value "value" = (value: Decimal prefix: Prefix? unit: Unit? !AlphaNumeric {
        return {
            type: "NumericValue",
            value,
            prefix,
            unit
        };
    }) / (value: AlphaNumeric {
        return {
            type: "SymbolicValue",
            value
        };
    })
    Identifier "identifier" = $(Alpha (Integer Alpha?)*)
    Description "description" = QuotedString
    
    Space "white space" = [ \\t\\n]+
    Alpha = $Character+
    Character = [a-z]i
    QuotedString = '"' chars:StringCharacter* '"' {return chars && chars.join("");}
    StringCharacter = char:[^\\\\"] {return char;} / "\\\\" '"' {return '"';}
    Integer = $Numeric+
    Numeric = [0-9]
    AlphaNumeric = $(Character / Numeric)+
    Decimal = $[0-9.+-]+
    Prefix = "p" / "n" / "u" / "m" / "k" / "M" / "G"
    Unit "unit" = Alpha
`;
    try {
        const parser = generate(grammar, { trace: false });
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
    } catch (err) {
        if (err instanceof parser.SyntaxError) {
            throw err.format([
                {
                    source: "input",
                    text: source,
                },
            ]);
        }
        throw err;
    }
}
