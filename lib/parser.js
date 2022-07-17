"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = exports.createParser = void 0;
var peggy_1 = require("peggy");
function createParser() {
    var grammar = "\n    start = schematic\n    schematic = (connection / part)+\n    connection =\n        source:(component / port)\n        connections:(\n            sourceTerminal:terminal? space wire space targetTerminal:terminal? target:(component / port) {\n                return {\n                    sourceTerminal,\n                    target,\n                    targetTerminal\n                };\n            }\n        )* {\n            return {\n                type: \"connection\",\n                source,\n                connections: connections ?? []\n            };\n        }\n    part = definition \"\\n\"\n    port = \"<\" id:identifier spec:portspecifier? \">\" {\n        return {\n            type: \"port\",\n            identifier: id,\n            specifier: spec\n        };\n    }\n    portspecifier = \":\" id: identifier {\n        return id;\n    }\n    wire = \"-\"\n    terminal = character / [+-]\n    component = open:open space? definition:definition? space? close:close {\n        return {\n            type: \"component\",\n            open,\n            definition,\n            close\n        };\n    }\n    open \"component start\" = \"[\" / \"|\" / \">\" / \"(\" / \"$\" / \":\" / \"/\"\n    close \"component end\" = \"]\" / \"|\" / \"]\" / \")\" / \"$\" / \":\" / \"/\"\n    definition =\n        designatorAndValue: (\n            (\n                designator:designator space? \":\" space? value: value {\n                    return {\n                        designator,\n                        value\n                    };\n                }\n            )\n            /\n            (\n                designator:designator {return {designator};}\n                /\n                value:value {return {value};}\n            )\n        )?\n        space? symbol: (\"!\" id: identifier {return id;})?\n        space? description: description?\n        {\n            return {\n                type: \"definition\",\n                ...designatorAndValue,\n                symbol,\n                description\n            };\n        }\n    designator = designator:alpha index:integer {\n        return {\n            designator,\n            index: parseInt(index, 10),\n        };\n    }\n    value \"value\" = (value: decimal prefix: prefix? unit: unit? {\n        return {\n            type: \"numericValue\",\n            value: parseFloat(value),\n            prefix,\n            unit\n        };\n    }) / (value: identifier {\n        return {\n            type: \"symbolicValue\",\n            value\n        };\n    })\n    identifier \"identifier\" = $(alpha+ (integer alpha?)*)\n    description = quotedstring\n    \n    space \"white space\" = [ \\t]+\n    alpha = $character+\n    character = [a-z]i\n    quotedstring = '\"' chars:stringcharacter* '\"' {return chars && chars.join(\"\");}\n    stringcharacter = char:[^\\\\\"] {return char;} / \"\\\\\" '\"' {return '\"';}\n    integer = $[0-9]+\n    decimal = $[0-9.]+\n    prefix = \"p\" / \"n\" / \"u\" / \"m\" / \"k\" / \"M\" / \"G\"\n    unit = alpha\n";
    try {
        var parser = (0, peggy_1.generate)(grammar);
        return parser;
    }
    catch (err) {
        if ("format" in err) {
            var error = err;
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
    var parser = createParser();
    try {
        var parsed = parser.parse(source);
        return parsed;
    }
    catch (err) {
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
exports.parse = parse;
