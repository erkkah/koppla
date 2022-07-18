import { strict as assert } from "assert";
import ELK, { Label, Node as ELKNode, Edge as ELKEdge } from "elkjs";
import { CompiledSchematic, CompiledNode } from "./compiler";
import { NumericValue, Value } from "./parser";

export async function render(schematic: CompiledSchematic): Promise<string> {
    const elk = new ELK();

    const nodes: ELKNode[] = schematic.nodes.map((node) => ({
        id: node.ID,
        labels: labelsFromNode(node),
        width: 10,
        height: 10,
    }));

    const edges: ELKEdge[] = schematic.edges.map((edge, index) => ({
        id: `E${index}`,
        source: edge.source.ID,
        target: edge.target.ID,
    }));

    const root: ELKNode = {
        id: "root",
        children: nodes,
        edges: edges,
    };

    const laidOut = await elk.layout(root);
    return JSON.stringify(laidOut);
}

let labelIndex = 0;

function makeLabel(text: string): Label {
    return {
        id: `LBL${labelIndex++}`,
        text,
    };
}

function labelsFromNode(node: CompiledNode): Label[] {
    const labels: Label[] = [makeLabel(node.ID)];
    if (node.description) {
        labels.push(makeLabel(node.description));
    }
    if (node.value) {
        labels.push(makeLabel(valueToString(node.value)));
    }
    return labels;
}

function valueToString(value: Value): string {
    switch (value.type) {
        case "NumericValue":
            assert(value.type === "NumericValue");
            return formatValue(value);
        case "SymbolicValue":
            assert(value.type === "SymbolicValue");
            return value.value;
        default:
            assert(false, "Unhandled value type");
    }
}

function formatValue(value: NumericValue): string {
    const prefix = value.prefix === "u" ? "µ" : value.prefix;
    return `${value.value}${prefix || ""}${value.unit || ""}`;
}
