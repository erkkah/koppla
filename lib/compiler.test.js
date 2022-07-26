"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const compiler_1 = require("./compiler");
const symbols_1 = require("./symbols");
describe("compiler", () => {
    const symbols = new symbols_1.CoreSymbols();
    it("compiles empty schematic", () => {
        const parsed = (0, parser_1.parse)("");
        const compiled = (0, compiler_1.compile)(parsed, symbols);
        expect(compiled.edges).toHaveLength(0);
        expect(compiled.nodes).toHaveLength(0);
    });
    it("handles automatic assignment", () => {
        const parsed = (0, parser_1.parse)("[22k]");
        const compiled = (0, compiler_1.compile)(parsed, symbols);
        expect(compiled.edges).toHaveLength(0);
        expect(compiled.nodes).toHaveLength(1);
        const [node] = compiled.nodes;
        expect(node.ID).toBe("R1");
    });
    it("handles duplicate definitions", () => {
        const parsed = (0, parser_1.parse)("[R1:22k] - [R1 \"resistor\"]");
        const compiled = (0, compiler_1.compile)(parsed, symbols);
        expect(compiled.edges).toHaveLength(1);
        expect(compiled.nodes).toHaveLength(1);
        const [node] = compiled.nodes;
        expect(node.ID).toBe("R1");
        expect(node.description).toBe("resistor");
    });
    it("handles chained connections", () => {
        const parsed = (0, parser_1.parse)("[R1] - [R2] - [R3]");
        const compiled = (0, compiler_1.compile)(parsed, symbols);
        expect(compiled.edges).toHaveLength(2);
        expect(compiled.nodes).toHaveLength(3);
        const [e1, e2] = compiled.edges;
        expect(e1.source.ID).toBe("R1");
        expect(e1.target.ID).toBe("R2");
        expect(e2.source.ID).toBe("R2");
        expect(e2.target.ID).toBe("R3");
    });
    it("fails to compile mismatched symbol and designator", () => {
        expect(() => {
            const parsed = (0, parser_1.parse)("[C1] - |R1|");
            (0, compiler_1.compile)(parsed, symbols);
        }).toThrow();
    });
    it("handles diodes in both directions", () => {
        const parsed = (0, parser_1.parse)("|< - [ ]");
        const compiled = (0, compiler_1.compile)(parsed, symbols);
        expect(compiled.edges).toHaveLength(1);
        expect(compiled.nodes).toHaveLength(2);
        const [diode, resistor] = compiled.nodes;
        const [wire] = compiled.edges;
        expect(wire.source).toBe(diode.ID);
        expect(wire.target).toBe(resistor.ID);
        expect(wire.sourceTerminal).toBe("a");
        expect(wire.targetTerminal).toBe("a");
    });
});
//# sourceMappingURL=compiler.test.js.map