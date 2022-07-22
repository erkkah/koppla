"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimize = exports.render = void 0;
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
            koppla: { node, rotation: 0 },
            ports,
        };
    });
    const edges = schematic.edges.map((edge, index) => ({
        id: `E${index}`,
        sources: [`${edge.source.ID}:P${edge.sourceTerminal}`],
        targets: [`${edge.target.ID}:P${edge.targetTerminal}`],
    }));
    const graph = {
        id: "root",
        children: nodes,
        edges,
    };
    // https://www.eclipse.org/elk/reference/algorithms/org-eclipse-elk-layered.html
    const layoutOptions = {
        "org.eclipse.elk.algorithm": "layered",
        "org.eclipse.elk.direction": "DOWN",
        "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
        "org.eclipse.elk.nodeLabels.placement": "OUTSIDE H_LEFT V_TOP",
    };
    const prePass = (await elk.layout(cloneWithSkin(graph, symbols, skin, { squareBoundingBox: true }), {
        layoutOptions,
    }));
    const optimized = optimize(cloneWithSkin(graph, symbols, skin, { squareBoundingBox: true }), prePass);
    const laidOut = await elk.layout(optimized, {
        layoutOptions: Object.assign(Object.assign({}, layoutOptions), { "org.eclipse.elk.portConstraints": "FIXED_POS" }),
    });
    return renderSVG(laidOut);
}
exports.render = render;
function deepCopy(object) {
    const serialized = JSON.stringify(object);
    const copy = JSON.parse(serialized);
    (0, assert_1.strict)(serialized === JSON.stringify(copy));
    return copy;
}
function optimize(root, preprocessed) {
    for (const i in preprocessed.children) {
        const child = preprocessed.children[i];
        root.children[i] = rotateNode(root.children[i], child);
    }
    return root;
}
exports.optimize = optimize;
function rotateNode(fixed, processed) {
    var _a;
    if (fixed.ports === undefined) {
        (0, assert_1.strict)(processed.ports === undefined);
        return fixed;
    }
    (0, assert_1.strict)(fixed.ports.length === ((_a = processed.ports) === null || _a === void 0 ? void 0 : _a.length));
    const rotations = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    const rotatedNodes = rotations.map((rotation) => rotatedNode(fixed, rotation));
    const distances = rotatedNodes.map((node) => totalPortDistance(node, processed));
    let minDistance = Number.MAX_VALUE;
    let minIndex = -1;
    for (let i = 0; i < distances.length; i++) {
        const distance = distances[i];
        if (distance < minDistance) {
            minDistance = distance;
            minIndex = i;
        }
    }
    const bestNode = rotatedNodes[minIndex];
    bestNode.koppla.rotation = rotations[minIndex];
    if (minIndex === 1 || minIndex === 3) {
        [bestNode.width, bestNode.height] = [bestNode.height, bestNode.width];
    }
    return bestNode;
}
function rotatedNode(node, rotation) {
    var _a;
    (0, assert_1.strict)(node.width !== undefined);
    (0, assert_1.strict)(node.height !== undefined);
    const reference = {
        x: node.width / 2,
        y: node.height / 2,
    };
    const rotatedPorts = ((_a = node.ports) !== null && _a !== void 0 ? _a : []).map((port) => {
        (0, assert_1.strict)(port.x !== undefined);
        (0, assert_1.strict)(port.y !== undefined);
        const rotatedPoint = rotate({ x: port.x, y: port.y }, reference, rotation);
        return Object.assign(Object.assign({}, port), rotatedPoint);
    });
    return Object.assign(Object.assign({}, node), { ports: rotatedPorts });
}
function totalPortDistance(fixed, processed) {
    return fixed.ports.reduce((sum, fixedPort, index) => {
        (0, assert_1.strict)(processed.ports !== undefined);
        const processedPort = processed.ports[index];
        return sum + distance(fixedPort, processedPort);
    }, 0);
}
function rotate(p, reference, rotation) {
    if (rotation === 0) {
        return p;
    }
    const x = p.x - reference.x;
    const y = p.y - reference.y;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const xRot = cos * x - sin * y;
    const yRot = sin * x + cos * y;
    return {
        x: xRot + reference.x,
        y: yRot + reference.y,
    };
}
function distance(a, b) {
    const xDiff = a.x - b.x;
    const yDiff = a.y - b.y;
    return Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
}
function cloneWithSkin(graph, symbols, skin, options = { squareBoundingBox: false }) {
    var _a;
    const copy = deepCopy(graph);
    for (const child of (_a = copy.children) !== null && _a !== void 0 ? _a : []) {
        const symbol = child.koppla.node.symbol;
        const symbolInfo = symbols.lookup(symbol);
        (0, assert_1.strict)(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbol} not found in skin`);
        }
        child.koppla.skin = symbolSkin;
        if (options.squareBoundingBox) {
            child.width = Math.max(symbolSkin.size.x, symbolSkin.size.y);
            child.height = child.width;
        }
        else {
            child.width = symbolSkin.size.x;
            child.height = symbolSkin.size.y;
        }
    }
    return copy;
}
function round(value) {
    return String(Math.round(Number(value) * 1000) / 1000);
}
function renderSVG(layout) {
    const svgSymbols = layout.children.reduce((commands, node) => {
        const symbol = node.koppla.skin;
        (0, assert_1.strict)(symbol !== undefined);
        const rotation = (node.koppla.rotation * 180) / Math.PI;
        const reference = Math.max(symbol.size.x, symbol.size.y) / 2;
        const figure = `<g transform="
            translate(${round(node.x)}, ${round(node.y)})
            rotate(${rotation},${reference},${reference})
        ">
            ${symbol === null || symbol === void 0 ? void 0 : symbol.svgData}
        </g>`;
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
            return `<text x="${x}" y="${y}" alignment-baseline="hanging" style="fill:#000000;fill-opacity:1;stroke:none">${label.text}</text>`;
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