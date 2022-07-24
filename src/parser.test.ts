import assert = require("assert");
import {createParser, parse, Definition, Value} from "./parser";

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

describe("parse components", () => {
    const parser = createParser();

    it("parses empty components", () => {
        const components = [
            "[]",
            "||",
            "[|",
            "|]",
            ">|",
            "()",
            "**"
        ]
        for (const component of components) {
            parser.parse(component);
        }
    });

    it("fails to parse invalid component", () => {
        const invalid = "/]"
        expect(() => {
            parser.parse(invalid);
        }).toThrow();
    });

    it("parses space-filled component", () => {
        parser.parse("[     ]");
    });

    it("parses designator", () => {
        parser.parse("[R12]");
    })

    it("parses value", () => {
        parser.parse("|47uF]");
    })

    it("parses designator and value", () => {
        parser.parse("[R87: 1.2k]");
    });

    it("parses part spec", () => {
        parser.parse("*!integrator*");
    })

    it("parses generic part with designator and value", () => {
        parser.parse("*R78:19k*")
    });

    it("parses a complete thing", () => {
        parser.parse("|C99: 4.7nF !supercap \"A really special cap\"|")
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

});

describe("parse parts", () => {
    const parser = createParser();

    it("parses part definition", () => {
        parser.parse("R1: 1k \"main\"\n");
    });

    it("parses components and parts", () => {
        const code = `
        [D1] - [D2]
        
        R1: 1k
        `;
        parser.parse(code);
    })
});

describe("parse connections", () => {
    const parser = createParser();

    it("parses port to component", () => {
        parser.parse("<in> - [R1]");
    });

    it("parses port to component terminal", () => {
        parser.parse("<in> - e(Q1)");
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
        const schematic = parse("|C1:2.2nF !supercap \"A special cap\"|");
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
        expect(source.identifier).toBe("in");
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
            index: 12
        };

        expect(wire.target.definition.designator).toStrictEqual(expectedDesignator);
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
            value: "TL072"
        });
    });

    it("components and parts", () => {
        const code = `
        [R1] - [R2]
        #[R1]a - :GND:
        
        R1: 1k
        `;
        const schematic = parse(code);
        expect(schematic.body).toHaveLength(2);
        
    })
});
