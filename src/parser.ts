import { generate, parser, Parser } from "peggy";

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
    location: SourceLocation;
}

export interface Component {
    type: "Component";
    open: string;
    definition: Definition;
    close: string;
    location: SourceLocation;
}

export interface Port {
    type: "Port";
    kind: "in" | "out" | "gnd" | "v";
    specifier?: string;
    symbol?: string;
    location: SourceLocation;
}

export type Node = Component | Port;

interface Connection {
    sourceTerminal?: string;
    target: Node;
    targetTerminal?: string;
    location: SourceLocation;
}

export interface ConnectionStatement {
    type: "Connection";
    source: Node;
    connections: Connection[];
}

export interface Settings {
    type: "Settings";
    settings: Array<{
        key: string;
        value: string;
    }>;
    location: SourceLocation;
}

export interface SourceLocation {
    source: string;
    start: {
        offset: number;
        line: number;
        column: number;
    }
}

export type Statement = ConnectionStatement | Definition | Settings;

export interface Schematic {
    type: "Schematic";
    body: Statement[];
}

function validComponentDelimiters(start: string, end: string): boolean {
    switch (start) {
        case "[":
            return ["]", "|", "<"].includes(end);
        case "|":
            return ["|", "]", "<"].includes(end);
        case ">":
            return ["|", "]", "/"].includes(end);
        case "(":
            return end === ")";
        case "$":
            return end === "$";
        case "*":
            return end === "*";
        case "/":
            return ["/", "<"].includes(end);
        default:
            return false;
    }
}

export function createParser(): Parser {
    const grammar = `
    {{
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

    Element = Connection / Part / Settings

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
                    targetTerminal,
                    location: location(),
                };
            }
        )* {
            return {
                type: "Connection",
                source,
                connections: connections ?? [],
                location: location()
            };
        }
    Part "part" = PartDefinition
    Settings = "{" settings:Setting* WSC "}" {
        return {
            type: "Settings",
            settings,
            location: location()
        };
    }
    Setting = WSC key:AlphaNumeric WSC ":" WSC value:(QuotedString / Decimal / Integer / Boolean) WSC ","? {
        return {
            key,
            value,
        };
    }
    Port "port" = "<" kind:PortKind spec:PortSpecifier? symbol:Symbol? ">" {
        return {
            type: "Port",
            kind: kind,
            specifier: spec,
            symbol,
            location: location(),
        };
    }
    PortSpecifier = ":" spec:AlphaNumeric {
        return spec;
    }
    Wire = "-"
    Terminal "terminal" = $(Character / [+-])+
    Component = open:Open WSC definition:Definition? WSC close:Close {
        if (!validComponentDelimiters(open, close)) {
            error("Invalid component");
        }
        return {
            type: "Component",
            open,
            definition,
            close,
            location: location(),
        };
    }
    Open "component start" = "[" / "|" / ">" / "(" / "$" / "*" / "/"
    Close "component end" = "]" / "|" / "<" / ")" / "$" / "*" / "/"
    PartDefinition =
        designator: Designator ":"
        WSC
        value: Value?
        WSC
        symbolAndDescription: SymbolAndDescription {
            return {
                type: "Definition",
                designator,
                value,
                ...symbolAndDescription,
                location: location()
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
                ...symbolAndDescription,
                location: location()
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
    Designator "designator" = WSC designator:Alpha index:Integer {
        return {
            designator,
            index: parseInt(index, 10),
        };
    }
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
    PortKind "port kind" = kind:("GND"i / "IN"i / "OUT"i / "V"i) {
        return kind.toUpperCase();
    }
    Identifier "identifier" = $(Alpha (Integer Alpha?)*)
    Description "description" = QuotedString
    
    Prefix = "p" / "n" / "u" / "m" / "k" / "M" / "G"
    Unit "unit" = Alpha
    Space "white space" = [ \\t\\n]+
    Alpha = $Character+
    QuotedString = '"' chars:StringCharacter* '"' {return chars && chars.join("");}
    Integer "integer" = $Numeric+
    Decimal "decimal" = $(Sign?[0-9]+[.]?[0-9]*)
    Boolean "boolean" = "true" / "false"
    AlphaNumeric = $(Character / Numeric / Sign / ".")+
    Character = [a-z]i
    StringCharacter = char:[^\\\\"] {return char;} / "\\\\" '"' {return '"';}
    Numeric = [0-9]
    Sign = "+" / "-"
`;
    try {
        const parser = generate(grammar, { trace: false });
        return parser;
    } catch (err) {
        if ("format" in (err as Record<string, unknown>)) {
            const error = err as parser.SyntaxError;
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

export function parse(source: string, fileName?: string): Schematic {
    const parser = createParser();

    try {
        const parsed = parser.parse(source, { grammarSource: fileName });
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
