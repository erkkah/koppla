import assert = require("assert");
import { createParser, parse, Definition, Value, Settings } from "./parser";

describe("parse comments", () => {
    it("parses single line comments", () => {
        const source = `
        # First comment
        [R1] # Second comment
        # Third comment
        `;
        const schematic = parse(source);
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;
        assert(connection.type === "Connection");
    });

    it("parses multi line comments", () => {
        const source = `
        #*
        [R1] # Single line comment
        *#
        [R1]
        `;
        const schematic = parse(source);
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;
        assert(connection.type === "Connection");
    });
});

describe("parse settings", () => {
    it("parses empty settings section", () => {
        parse("{}");
    });

    it("parses a settings section", () => {
        const schematic = parse(`
        # Settings:
        {
            a.string: "a string value",
            an.integer: 123,
            a.decimal: 3.14,
            a.boolean: true
        }
        `);
        expect(schematic.body).toHaveLength(1);
        const [setting] = schematic.body;
        assert(setting.type === "Settings");
        const expected: Settings["settings"] = [
            {
                key: "a.string",
                value: {
                    type: "String",
                    value: "a string value",
                },
            },
            {
                key: "an.integer",
                value: {
                    type: "Number",
                    value: 123,
                },
            },
            {
                key: "a.decimal",
                value: {
                    type: "Number",
                    value: 3.14,
                },
            },
            {
                key: "a.boolean",
                value: {
                    type: "Boolean",
                    value: true,
                },
            },
        ];
        expect(setting).toMatchObject({
            settings: expected,
        });
    });
});

describe("parse components", () => {
    function parseComponent(code: string): Definition {
        const schematic = parse(code);
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;
        assert(connection.type === "Connection");
        const { source } = connection;
        assert(source.type === "Component");
        return source.definition;
    }

    it("parses empty components", () => {
        const components = ["[]", "||", "[|", "|]", ">|", "()", "**"];
        for (const component of components) {
            parse(component);
        }
    });

    it("fails to parse invalid component", () => {
        const invalid = "/]";
        expect(() => {
            parse(invalid);
        }).toThrow();
    });

    it("parses space-filled component", () => {
        parse("[     ]");
    });

    it("parses designator", () => {
        const component = parseComponent("[R12]");
        expect(component.designator).toEqual({
            designator: "R",
            index: 12,
        });
    });

    it("parses numeric value", () => {
        const component = parseComponent("|47uF]");
        expect(component.designator).toBeUndefined();
        assert(component.value?.type === "NumericValue");
        expect(component.value.prefix).toBe("u");
        expect(component.value.unit).toBe("F");
        expect(component.value.value).toBe("47");
    });

    it("parses symbolic value", () => {
        const component = parseComponent(">1N4148|");
        expect(component.designator).toBeUndefined();
        expect(component.value?.value).toBe("1N4148");
    });

    it("parses designator and value", () => {
        parse("[R87: 1.2k]");
    });

    it("parses part spec", () => {
        parse("*!integrator*");
    });

    it("parses generic part with designator and value", () => {
        parse("*R78:19k*");
    });

    it("parses a complete thing", () => {
        parse('|C99: 4.7nF !supercap "A really special cap"|');
    });
});

describe("parse ports", () => {
    const parser = createParser();

    it("parses typed port", () => {
        parser.parse("<in>");
    });

    it("parses subtyped port", () => {
        parser.parse("<in:main>");
    });

    it("parses voltage port", () => {
        parser.parse("<v:+5v>");
    });
});

describe("parse parts", () => {
    const parser = createParser();

    it("parses part definition", () => {
        parser.parse('R1: 1k "main"\n');
    });

    it("parses components and parts", () => {
        const code = `
        [D1] - [D2]
        
        R1: 1k
        `;
        parser.parse(code);
    });
});

describe("parse connections", () => {
    const parser = createParser();

    it("parses port to component", () => {
        parser.parse("<in> - [R1]");
    });

    it("fails to parse connections without spaces", () => {
        expect(() => {
            parse("<in>-[R1]");
        }).toThrow();
    });

    it("parses port to component terminal", () => {
        parser.parse("<in> - e(Q1)");
    });

    it("parses connection to multicharacter terminal", () => {
        parser.parse("<in> - v+(U1)");
    });

    it("parses multi component connection", () => {
        parser.parse("<in> - [ ] - >| - e(Q1)");
    });
});

describe("validate parsed structure", () => {
    test("single empty component", () => {
        const schematic = parse("[   ]");
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;
        assert(connection.type === "Connection");
        expect(connection.connections).toHaveLength(0);
        assert(connection.source.type === "Component");
        const source = connection.source;
        expect(source.open).toBe("[");
        expect(source.close).toBe("]");
        expect(source.definition.type).toBe("Definition");
        const definition = source.definition;
        expect(definition.description).toBeNull();
        expect(definition.designator).toBeUndefined();
        expect(definition.value).toBeUndefined();
    });

    test("single complete component", () => {
        const schematic = parse('|C1:2.2nF !supercap "A special cap"|');
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;

        assert(connection.type === "Connection");
        expect(connection.connections).toHaveLength(0);

        assert(connection.source.type === "Component");
        const source = connection.source;
        expect(source.open).toBe("|");
        expect(source.close).toBe("|");

        expect(source.definition.type).toBe("Definition");
        const definition = source.definition;

        const expectedDesignator: Definition["designator"] = {
            designator: "C",
            index: 1,
        };
        expect(definition.designator).toStrictEqual(expectedDesignator);

        const expectedValue: Value = {
            type: "NumericValue",
            prefix: "n",
            unit: "F",
            value: "2.2",
        };

        expect(definition.value).toStrictEqual(expectedValue);

        expect(definition.description).toEqual("A special cap");
        expect(definition.symbol).toEqual("supercap");
    });

    test("simple connection", () => {
        const schematic = parse("<in:main> - [R12]");
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;

        assert(connection.type === "Connection");
        assert(connection.source.type === "Port");
        const source = connection.source;
        expect(source.kind).toBe("IN");
        expect(source.specifier).toBe("main");

        expect(connection.connections).toHaveLength(1);

        const [wire] = connection.connections;
        expect(wire.sourceTerminal).toBeNull();
        expect(wire.targetTerminal).toBeNull();

        assert(wire.target.type === "Component");
        expect(wire.target.open).toBe("[");
        expect(wire.target.close).toBe("]");

        const expectedDesignator: Definition["designator"] = {
            designator: "R",
            index: 12,
        };

        expect(wire.target.definition.designator).toStrictEqual(
            expectedDesignator
        );
    });

    test("multiple step connection", () => {
        const schematic = parse("<in:main> - [R12] - -/U1:TL072/");
        expect(schematic.body).toHaveLength(1);
        const [connection] = schematic.body;
        assert(connection.type === "Connection");
        expect(connection.connections).toHaveLength(2);

        const lastConnection = connection.connections[1];
        expect(lastConnection.targetTerminal).toBe("-");

        const target = lastConnection.target;
        assert(target.type === "Component");
        expect(target.definition.value).toEqual({
            type: "SymbolicValue",
            value: "TL072",
        });
    });

    it("components and parts", () => {
        const code = `
        [R1] - [R2]
        
        R1: 1k
        `;
        const schematic = parse(code);
        expect(schematic.body).toHaveLength(2);
    });
});
