"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = void 0;
const assert_1 = require("assert");
const elkjs_1 = require("elkjs");
async function render(schematic) {
    const elk = new elkjs_1.default();
    const nodes = schematic.nodes.map((node) => ({
        id: node.ID,
        labels: labelsFromNode(node),
        width: 10,
        height: 10,
    }));
    const edges = schematic.edges.map((edge, index) => ({
        id: `E${index}`,
        source: edge.source.ID,
        target: edge.target.ID,
    }));
    const root = {
        id: "root",
        children: nodes,
        edges: edges,
    };
    const laidOut = await elk.layout(root);
    return JSON.stringify(laidOut);
}
exports.render = render;
let labelIndex = 0;
function makeLabel(text) {
    return {
        id: `LBL${labelIndex++}`,
        text,
    };
}
function labelsFromNode(node) {
    const labels = [makeLabel(node.ID)];
    if (node.description) {
        labels.push(makeLabel(node.description));
    }
    if (node.value) {
        labels.push(makeLabel(valueToString(node.value)));
    }
    return labels;
}
function valueToString(value) {
    switch (value.type) {
        case "NumericValue":
            (0, assert_1.strict)(value.type === "NumericValue");
            return formatValue(value);
        case "SymbolicValue":
            (0, assert_1.strict)(value.type === "SymbolicValue");
            return value.value;
        default:
            (0, assert_1.strict)(false, "Unhandled value type");
    }
}
function formatValue(value) {
    const prefix = value.prefix === "u" ? "µ" : value.prefix;
    return `${value.value}${prefix || ""}${value.unit || ""}`;
}
