"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.createParser = void 0;
const peggy_1 = require("peggy");
function validComponentDelimiters(start, end) {
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
function createParser() {
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
        const parser = (0, peggy_1.generate)(grammar, { trace: false });
        return parser;
    }
    catch (err) {
        if ("format" in err) {
            const error = err;
            throw error.format([
                {
                    source: undefined,
                    text: grammar,
                },
            ]);
        }
        else {
            throw err;
        }
    }
}
exports.createParser = createParser;
function parse(source, fileName) {
    const parser = createParser();
    try {
        const parsed = parser.parse(source, { grammarSource: fileName });
        return parsed;
    }
    catch (err) {
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
exports.parse = parse;
//# sourceMappingURL=parser.js.map