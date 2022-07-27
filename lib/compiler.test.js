"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const compiler_1 = require("./compiler");
const symbols_1 = require("./symbols");
describe("compiler", () => {
    const symbols = symbols_1.CoreSymbols.load("symbols/symbols.json");
    it("compiles empty schematic", async () => {
        const parsed = (0, parser_1.parse)("");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(0);
        expect(compiled.nodes).toHaveLength(0);
    });
    it("handles automatic assignment", async () => {
        const parsed = (0, parser_1.parse)("[22k]");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(0);
        expect(compiled.nodes).toHaveLength(1);
        const [node] = compiled.nodes;
        expect(node.ID).toBe("R1");
    });
    it("handles duplicate definitions", async () => {
        const parsed = (0, parser_1.parse)("[R1:22k] - [R1 \"resistor\"]");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(1);
        expect(compiled.nodes).toHaveLength(1);
        const [node] = compiled.nodes;
        expect(node.ID).toBe("R1");
        expect(node.description).toBe("resistor");
    });
    it("handles chained connections", async () => {
        const parsed = (0, parser_1.parse)("[R1] - [R2] - [R3]");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(2);
        expect(compiled.nodes).toHaveLength(3);
        const [e1, e2] = compiled.edges;
        expect(e1.source.ID).toBe("R1");
        expect(e1.target.ID).toBe("R2");
        expect(e2.source.ID).toBe("R2");
        expect(e2.target.ID).toBe("R3");
    });
    it("fails to compile mismatched symbol and designator", async () => {
        const loadedSymbols = await symbols;
        expect(() => {
            const parsed = (0, parser_1.parse)("[C1] - |R1|");
            (0, compiler_1.compile)(parsed, loadedSymbols);
        }).toThrow();
    });
    it("handles diodes in both directions", async () => {
        const parsed = (0, parser_1.parse)(">| - |< - >|");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(2);
        expect(compiled.nodes).toHaveLength(3);
        const [d1, d2, d3] = compiled.nodes;
        const [w1, w2] = compiled.edges;
        expect(w1.source.ID).toBe(d1.ID);
        expect(w1.target.ID).toBe(d2.ID);
        expect(w2.source.ID).toBe(d2.ID);
        expect(w2.target.ID).toBe(d3.ID);
        expect(w1.sourceTerminal).toBe("c");
        expect(w1.targetTerminal).toBe("c");
        expect(w2.sourceTerminal).toBe("a");
        expect(w2.targetTerminal).toBe("a");
    });
    it("handles polarized caps in both directions", async () => {
        const parsed = (0, parser_1.parse)("|] - [|");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(1);
        expect(compiled.nodes).toHaveLength(2);
        const [c1, c2] = compiled.nodes;
        const [wire] = compiled.edges;
        expect(wire.source.ID).toBe(c1.ID);
        expect(wire.target.ID).toBe(c2.ID);
        expect(wire.sourceTerminal).toBe("+");
        expect(wire.targetTerminal).toBe("+");
    });
    it("compiles symbol overrides", async () => {
        const parsed = (0, parser_1.parse)(">/ - >!D/");
        const compiled = (0, compiler_1.compile)(parsed, await symbols);
        expect(compiled.edges).toHaveLength(1);
        expect(compiled.nodes).toHaveLength(2);
        const [d1, d2] = compiled.nodes;
        expect(d1.symbol).toBe("DZEN");
        expect(d2.symbol).toBe("D");
    });
});
//# sourceMappingURL=compiler.test.js.map