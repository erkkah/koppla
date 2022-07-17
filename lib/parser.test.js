"use strict";
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var assert = require("assert");
var parser_1 = require("./parser");
describe("parse components", function () {
    var parser = (0, parser_1.createParser)();
    it("parses empty components", function () {
        var e_1, _a;
        var components = [
            "[]",
            "||",
            "[|",
            "|]",
            ">|",
            "()",
            "::"
        ];
        try {
            for (var components_1 = __values(components), components_1_1 = components_1.next(); !components_1_1.done; components_1_1 = components_1.next()) {
                var component = components_1_1.value;
                parser.parse(component);
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (components_1_1 && !components_1_1.done && (_a = components_1.return)) _a.call(components_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    });
    it("fails to parse invalid component", function () {
        var invalid = "#&";
        expect(function () {
            parser.parse(invalid);
        }).toThrow();
    });
    it("parses space-filled component", function () {
        parser.parse("[     ]");
    });
    it("parses designator", function () {
        parser.parse("[R12]");
    });
    it("parses value", function () {
        parser.parse("|47uF]");
    });
    it("parses designator and value", function () {
        parser.parse("[R87: 1.2k]");
    });
    it("parses part spec", function () {
        parser.parse(":!integrator:");
    });
    it("parses generic part with designator and value", function () {
        parser.parse(":R78:19k:");
    });
    it("parses a complete thing", function () {
        parser.parse("|C99: 4.7nF !supercap \"A really special cap\"|");
    });
});
describe("parse ports", function () {
    var parser = (0, parser_1.createParser)();
    it("parses typed port", function () {
        parser.parse("<in>");
    });
    it("parses subtyped port", function () {
        parser.parse("<in:main>");
    });
});
describe("parse parts", function () {
    var parser = (0, parser_1.createParser)();
    it("parses part definition", function () {
        parser.parse("R1: 1k \"main\"\n");
    });
});
describe("parse connections", function () {
    var parser = (0, parser_1.createParser)();
    it("parses port to component", function () {
        parser.parse("<in> - [R1]");
    });
    it("parses port to component terminal", function () {
        parser.parse("<in> - e(Q1)");
    });
    it("parses multi component connection", function () {
        parser.parse("<in> - [ ] - >| - e(Q1)");
    });
});
describe("validate parsed structure", function () {
    test("single empty component", function () {
        var schematic = (0, parser_1.parse)("[   ]");
        expect(schematic).toHaveLength(1);
        var _a = __read(schematic, 1), connection = _a[0];
        assert(connection.type === "connection");
        expect(connection.connections).toHaveLength(0);
        assert(connection.source.type === "component");
        var source = connection.source;
        expect(source.open).toBe("[");
        expect(source.close).toBe("]");
        expect(source.definition.type).toBe("definition");
        var definition = source.definition;
        expect(definition.description).toBeNull();
        expect(definition.designator).toBeUndefined();
        expect(definition.value).toBeUndefined();
    });
    test("single complete component", function () {
        var schematic = (0, parser_1.parse)("|C1:2.2nF !supercap \"A special cap\"|");
        expect(schematic).toHaveLength(1);
        var _a = __read(schematic, 1), connection = _a[0];
        assert(connection.type === "connection");
        expect(connection.connections).toHaveLength(0);
        assert(connection.source.type === "component");
        var source = connection.source;
        expect(source.open).toBe("|");
        expect(source.close).toBe("|");
        expect(source.definition.type).toBe("definition");
        var definition = source.definition;
        var expectedDesignator = {
            designator: "C",
            index: 1,
        };
        expect(definition.designator).toStrictEqual(expectedDesignator);
        var expectedValue = {
            type: "numericValue",
            prefix: "n",
            unit: "F",
            value: 2.2,
        };
        expect(definition.value).toStrictEqual(expectedValue);
        expect(definition.description).toEqual("A special cap");
        expect(definition.symbol).toEqual("supercap");
    });
    test("simple connection", function () {
        var schematic = (0, parser_1.parse)("<in:main> - [R12]");
        expect(schematic).toHaveLength(1);
        var _a = __read(schematic, 1), connection = _a[0];
        assert(connection.type === "connection");
        assert(connection.source.type === "port");
        var source = connection.source;
        expect(source.identifier).toBe("in");
        expect(source.specifier).toBe("main");
        expect(connection.connections).toHaveLength(1);
        var _b = __read(connection.connections, 1), wire = _b[0];
        expect(wire.sourceTerminal).toBeNull();
        expect(wire.targetTerminal).toBeNull();
        assert(wire.target.type === "component");
        expect(wire.target.open).toBe("[");
        expect(wire.target.close).toBe("]");
        var expectedDesignator = {
            designator: "R",
            index: 12
        };
        expect(wire.target.definition.designator).toStrictEqual(expectedDesignator);
    });
    test("multiple step connection", function () {
        var schematic = (0, parser_1.parse)("<in:main> - [R12] - -/U1:TL072/");
        expect(schematic).toHaveLength(1);
        var _a = __read(schematic, 1), connection = _a[0];
        assert(connection.type === "connection");
        expect(connection.connections).toHaveLength(2);
        var lastConnection = connection.connections[1];
        expect(lastConnection.targetTerminal).toBe("-");
        var target = lastConnection.target;
        assert(target.type === "component");
        expect(target.definition.value).toEqual({
            type: "symbolicValue",
            value: "TL072"
        });
    });
});
