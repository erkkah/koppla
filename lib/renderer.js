"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = void 0;
const assert_1 = require("assert");
const elkjs_1 = __importDefault(require("elkjs"));
async function render(schematic, symbols, skin) {
    const elk = new elkjs_1.default();
    const nodes = schematic.nodes.map((node) => {
        const symbolInfo = symbols.lookup(node.symbol);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbolInfo.ID} not found in skin`);
        }
        const terminals = symbolSkin.terminals;
        const ports = symbolInfo.terminals.map((terminal) => {
            const portPoint = terminals[terminal];
            if (portPoint === undefined) {
                throw new Error(`Symbol ${symbolInfo.ID} terminal ${terminal} not found in skin`);
            }
            return {
                id: `${node.ID}:P${terminal}`,
                x: portPoint.x,
                y: portPoint.y,
                width: 0,
                height: 0,
            };
        });
        return {
            id: node.ID,
            labels: labelsFromNode(node),
            width: symbolSkin.size.x,
            height: symbolSkin.size.y,
            koppla: { node },
            ports,
        };
    });
    const edges = schematic.edges.map((edge, index) => ({
        id: `E${index}`,
        sources: [`${edge.source.ID}:P${edge.sourceTerminal}`],
        targets: [`${edge.target.ID}:P${edge.targetTerminal}`],
    }));
    const root = {
        id: "root",
        children: nodes,
        edges,
    };
    setupFromSkin(root, symbols, skin);
    const laidOut = await elk.layout(root, {
        // https://www.eclipse.org/elk/reference/algorithms/org-eclipse-elk-layered.html
        layoutOptions: {
            "org.eclipse.elk.algorithm": "layered",
            "org.eclipse.elk.direction": "DOWN",
            "org.eclipse.elk.portConstraints": "FIXED_POS",
            "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
            "org.eclipse.elk.nodeLabels.placement": "OUTSIDE H_CENTER V_TOP",
        },
    });
    return renderSVG(laidOut);
}
exports.render = render;
function setupFromSkin(layout, symbols, skin) {
    var _a;
    for (const child of (_a = layout.children) !== null && _a !== void 0 ? _a : []) {
        const symbol = child.koppla.node.symbol;
        const symbolInfo = symbols.lookup(symbol);
        (0, assert_1.strict)(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbol} not found in skin`);
        }
        child.koppla.skin = symbolSkin;
        child.width = symbolSkin.size.x;
        child.height = symbolSkin.size.y;
    }
}
function round(value) {
    return String(Math.round(Number(value) * 1000) / 1000);
}
function renderSVG(layout) {
    const svgSymbols = layout.children.reduce((commands, node) => {
        const symbol = node.koppla.skin;
        const figure = `<g transform="translate(${round(node.x)}, ${round(node.y)})">${symbol === null || symbol === void 0 ? void 0 : symbol.svgData}</g>`;
        commands.push(figure);
        return commands;
    }, []);
    const svgWires = layout.edges.reduce((commands, edge) => {
        var _a;
        const lines = ((_a = edge.sections) !== null && _a !== void 0 ? _a : []).reduce((lines, section) => {
            var _a;
            const points = ((_a = section.bendPoints) !== null && _a !== void 0 ? _a : []).concat(section.endPoint);
            const lineTos = points.map((point) => `L${point.x} ${point.y}`);
            lines.push(`M${section.startPoint.x} ${section.startPoint.y} ${lineTos.join("")}`);
            return lines;
        }, []);
        const style = "fill:none;stroke:#000000;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1";
        const wire = `<path d="${lines.join(" ")}" style="${style}"/>`;
        commands.push(wire);
        return commands;
    }, []);
    const svgLabels = layout.children.flatMap((node) => {
        var _a;
        const labels = (_a = node.labels) !== null && _a !== void 0 ? _a : [];
        return labels.map((label) => {
            const x = round(Number(node.x) + Number(label.x));
            const y = round(Number(node.y) + Number(label.y));
            return `<text x="${x}" y="${y}" style="fill:#000000;fill-opacity:1;stroke:none">${label.text}</text>`;
        });
    });
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
        ${svgSymbols.join("")}
        ${svgWires.join("")}
        ${svgLabels.join("")}
        </svg>`;
}
let labelIndex = 0;
function makeLabel(text) {
    return {
        id: `LBL${labelIndex++}`,
        text,
        // ??? Hack!
        width: 10 * text.length,
        height: 10,
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
//# sourceMappingURL=renderer.js.map