"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.createParser = void 0;
const peggy_1 = require("peggy");
function inArray(wanted, valid) {
    return valid.findIndex((x) => x === wanted) >= 0;
}
function validComponentDelimiters(start, end) {
    console.log(`start: ${start}, end: ${end}`);
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
        case ":":
            return end === ":";
        case "/":
            return end === "/";
        default:
            return false;
    }
}
function createParser() {
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

    Start = WSC schematic:Schematic WSC {
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

    WhiteSpace = [ \\t\\r\\n]

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
    Part = definition:Definition EOL {
        return {
            type: "Part",
            definition
        };
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
    Terminal = Character / [+-]
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
    Open "component start" = "[" / "|" / ">" / "(" / "$" / ":" / "/"
    Close "component end" = "]" / "|" / "]" / ")" / "$" / ":" / "/"
    Definition =
        designatorAndValue: (
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
        )?
        WSC symbol: ("!" id: Identifier {return id;})?
        WSC description: Description?
        {
            return {
                type: "Definition",
                ...designatorAndValue,
                symbol,
                description
            };
        }
    Designator = designator:Alpha index:Integer {
        return {
            designator,
            index: parseInt(index, 10),
        };
    }
    Value "value" = (value: Decimal prefix: Prefix? unit: Unit? {
        return {
            type: "NumericValue",
            value,
            prefix,
            unit
        };
    }) / (value: Identifier {
        return {
            type: "SymbolicValue",
            value
        };
    })
    Identifier "identifier" = $(Alpha+ (Integer Alpha?)*)
    Description "description" = QuotedString
    
    Space "white space" = [ \\t\\n]+
    Alpha = $Character+
    Character = [a-z]i
    QuotedString = '"' chars:StringCharacter* '"' {return chars && chars.join("");}
    StringCharacter = char:[^\\\\"] {return char;} / "\\\\" '"' {return '"';}
    Integer = $[0-9]+
    Decimal = $[0-9.]+
    Prefix = "p" / "n" / "u" / "m" / "k" / "M" / "G"
    Unit = Alpha
`;
    try {
        const parser = (0, peggy_1.generate)(grammar, { trace: true });
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
function parse(source) {
    const parser = createParser();
    try {
        const parsed = parser.parse(source);
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
