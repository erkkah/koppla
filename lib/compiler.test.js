"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parser_1 = require("./parser");
const compiler_1 = require("./compiler");
describe("compiler", () => {
    it("compiles empty schematic", () => {
        const parsed = (0, parser_1.parse)("");
        const compiled = (0, compiler_1.compile)(parsed);
        expect(compiled.edges).toHaveLength(0);
        expect(compiled.nodes).toHaveLength(0);
    });
    it("handles automatic assignment", () => {
        const parsed = (0, parser_1.parse)("[22k]");
        const compiled = (0, compiler_1.compile)(parsed);
        expect(compiled.edges).toHaveLength(0);
        expect(compiled.nodes).toHaveLength(1);
        const [node] = compiled.nodes;
        expect(node.ID).toBe("R1");
    });
    it("handles duplicate definition", () => {
        const parsed = (0, parser_1.parse)("[R1:22k] - [R1 \"resistor\"]");
        const compiled = (0, compiler_1.compile)(parsed);
        expect(compiled.edges).toHaveLength(1);
        expect(compiled.nodes).toHaveLength(1);
        const [node] = compiled.nodes;
        expect(node.ID).toBe("R1");
        expect(node.description).toBe("resistor");
    });
    it("handles chained connections", () => {
        const parsed = (0, parser_1.parse)("[R1] - [R2] - [R3]");
        const compiled = (0, compiler_1.compile)(parsed);
        expect(compiled.edges).toHaveLength(2);
        expect(compiled.nodes).toHaveLength(3);
        const [e1, e2] = compiled.edges;
        expect(e1.source.ID).toBe("R1");
        expect(e1.target.ID).toBe("R2");
        expect(e2.source.ID).toBe("R2");
        expect(e2.target.ID).toBe("R3");
    });
});
