"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var peggy_1 = require("peggy");
function main() {
    try {
        var grammar = "\n        start = connection / part\n        connection = (component / port) (terminal? space wire space terminal? (component / port))*\n        part = identifier space? \":\" space? newlinestring\n        port = \"<\" identifier \">\"\n        wire = \"-\"\n        terminal = character\n        component = open space? definition? space? close\n        open \"component start\" = \"[\" / \"|\" / \">\" / \"(\" / \"$\" / \":\" / \"/\"\n        close \"component end\" = \"]\" / \"|\" / \"]\" / \")\" / \"$\" / \":\" / \"/\"\n        definition =\n            ((designator space? \":\" space? value) / (designator / value))?\n            (space? \"!\" identifier)?\n            (space? description)?\n        designator = string integer\n        value \"value\" = decimal prefix? unit?\n        identifier \"identifier\" = string\n        description = quotedstring\n        \n        space \"white space\" = [ \\t]+\n        string = character+\n        character = [a-z]i\n        newlinestring = chars:[^\\n] {return chars.join(\"\");}\n        quotedstring = '\"' chars:stringcharacter* '\"' {return chars.join(\"\");}\n        stringcharacter = char:[^\\\\\"] {return char;} / \"\\\\\" '\"' {return '\"';}\n        integer = [0-9]+\n        decimal = [0-9.]+\n        prefix = \"p\" / \"n\" / \"u\" / \"m\" / \"k\" / \"M\" / \"G\"\n        unit = string\n    ";
        console.log(grammar);
        var parser = (0, peggy_1.generate)(grammar);
        var parsed = parser.parse("[R2 : 22kohm !resistor \"hubba\"]");
        console.log(JSON.stringify(parsed, null, 2));
    }
    catch (err) {
        console.log("Parse error: ".concat(err));
    }
}
main();
//# sourceMappingURL=index.js.map