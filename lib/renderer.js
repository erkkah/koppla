"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optimize = exports.render = void 0;
const assert_1 = require("assert");
const elkjs_1 = __importDefault(require("elkjs"));
const DEBUG = false;
const font_1 = require("./font");
async function render(schematic, symbols, skin, options = { optimize: true, fontSize: 20 }) {
    const elk = new elkjs_1.default();
    let font = (0, font_1.defaultFont)(options.fontSize);
    if (options.fontFile) {
        font = await (0, font_1.loadFontAsDataURL)(options.fontFile, options.fontSize);
    }
    const nodes = schematic.nodes.map((node) => {
        const symbolInfo = symbols.lookup(node.symbol);
        if (symbolInfo === undefined) {
            throw new Error(`Symbol "${node.symbol}" not found`);
        }
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol "${symbolInfo.ID}" not found in skin`);
        }
        const terminals = symbolSkin.terminals;
        const ports = symbolInfo.terminals.map((terminal) => {
            const portPoint = terminals[terminal];
            if (portPoint === undefined) {
                throw new Error(`Symbol ${symbolInfo.ID} terminal "${terminal}" not found in skin`);
            }
            return {
                id: `${node.ID}:P${terminal}`,
                x: portPoint.x,
                y: portPoint.y,
                width: 0,
                height: 0,
            };
        });
        const width = symbolSkin.size.x;
        const height = symbolSkin.size.y;
        let layoutOptions = {};
        if (node.designator === "GND") {
            layoutOptions["org.eclipse.elk.layered.layering.layerConstraint"] =
                "LAST";
        }
        return {
            id: node.ID,
            labels: labelsFromNode(node, font),
            width,
            height,
            koppla: { node, rotation: 0 },
            ports,
            layoutOptions,
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
        "org.eclipse.elk.spacing.labelLabel": 3,
        "org.eclipse.elk.layered.layering.strategy": "LONGEST_PATH",
        "org.eclipse.elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "org.eclipse.elk.layered.compaction.postCompaction.strategy": "LEFT",
        "org.eclipse.elk.edge.thickness": 3.5,
    };
    /*
        org.eclipse.elk.layered.layering.strategy:
        NETWORK_SIMPLEX
        LONGEST_PATH
        COFFMAN_GRAHAM (@AdvancedPropertyValue)
        INTERACTIVE (@AdvancedPropertyValue)
        STRETCH_WIDTH (@ExperimentalPropertyValue)
        MIN_WIDTH (@ExperimentalPropertyValue)

        org.eclipse.elk.layered.nodePlacement.strategy:
        SIMPLE
        INTERACTIVE (@AdvancedPropertyValue)
        LINEAR_SEGMENTS
        BRANDES_KOEPF
        NETWORK_SIMPLEX

        org.eclipse.elk.layered.compaction.postCompaction.strategy:
        NONE
        LEFT
        RIGHT
        LEFT_RIGHT_CONSTRAINT_LOCKING
        LEFT_RIGHT_CONNECTION_LOCKING
        EDGE_LENGTH
    */
    const prePass = (await elk.layout(cloneWithSkin(graph, symbols, skin, { squareBoundingBox: true }), {
        layoutOptions,
    }));
    if (!options.optimize) {
        return renderSVG(prePass, font);
    }
    const graphWithSkin = cloneWithSkin(graph, symbols, skin, {
        squareBoundingBox: false,
    });
    const optimized = optimize(graphWithSkin, prePass);
    setupLabelPlacements(optimized);
    const laidOut = await elk.layout(optimized, {
        layoutOptions: Object.assign(Object.assign({}, layoutOptions), { "org.eclipse.elk.portConstraints": "FIXED_POS" }),
    });
    return renderSVG(laidOut, font);
}
exports.render = render;
function setupLabelPlacements(graph) {
    var _a;
    for (const child of graph.children) {
        (0, assert_1.strict)(child.width !== undefined);
        (0, assert_1.strict)(child.height !== undefined);
        const portEdges = [];
        for (const port of (_a = child.ports) !== null && _a !== void 0 ? _a : []) {
            (0, assert_1.strict)(port.x !== undefined);
            (0, assert_1.strict)(port.y !== undefined);
            if (port.x === 0) {
                portEdges.push("W");
                continue;
            }
            if (port.x === child.width) {
                portEdges.push("E");
                continue;
            }
            if (port.y === 0) {
                portEdges.push("N");
                continue;
            }
            if (port.y === child.height) {
                portEdges.push("S");
                continue;
            }
        }
        let placement = "OUTSIDE H_LEFT V_TOP";
        const placements = {
            "N": "OUTSIDE H_CENTER V_TOP",
            "S": "OUTSIDE H_CENTER V_BOTTOM",
            "E": "OUTSIDE H_RIGHT V_CENTER",
            "W": "OUTSIDE H_LEFT V_CENTER",
        };
        const edgePriorities = ["W", "E", "N", "S"];
        for (const edge of edgePriorities) {
            if (!portEdges.includes(edge)) {
                placement = placements[edge];
                break;
            }
        }
        child.layoutOptions = Object.assign(Object.assign({}, child.layoutOptions), { "org.eclipse.elk.nodeLabels.placement": placement });
    }
}
function deepCopy(object) {
    const serialized = JSON.stringify(object);
    const copy = JSON.parse(serialized);
    (0, assert_1.strict)(serialized === JSON.stringify(copy));
    return copy;
}
function optimize(root, preprocessed) {
    for (const i in preprocessed.children) {
        const preChild = preprocessed.children[i];
        const child = root.children[i];
        root.children[i] = rotateNode(child, preChild);
    }
    return root;
}
exports.optimize = optimize;
/**
 * Rotates a node to move ports to an optimal position according to a preprocessed graph.
 *
 * @param fixed Unprocessed node
 * @param processed Preprocessed node, laid out with no port restrictions
 * @returns Shallow copy of the fixed node in a rotation which minimizes the
 *  total port distance to the preprocessed node.
 */
function rotateNode(fixed, processed) {
    var _a, _b, _c;
    if (fixed.ports === undefined) {
        (0, assert_1.strict)(processed.ports === undefined);
        return fixed;
    }
    (0, assert_1.strict)(fixed.ports.length === ((_a = processed.ports) === null || _a === void 0 ? void 0 : _a.length));
    let bestIndex = -1;
    const fixedRotation = (_c = (_b = fixed.koppla.skin) === null || _b === void 0 ? void 0 : _b.options) === null || _c === void 0 ? void 0 : _c.rotationSteps;
    if (fixedRotation !== undefined) {
        bestIndex = fixedRotation;
    }
    else {
        const rotations = [0, 1, 2, 3];
        const rotatedNodes = rotations.map((rotation) => rotatedNode(fixed, rotation, { makeSquare: true }));
        const distances = rotatedNodes.map((node) => totalPortDistance(node, processed));
        let minDistance = Number.MAX_VALUE;
        for (let i = 0; i < distances.length; i++) {
            const distance = distances[i];
            if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i;
            }
        }
    }
    const bestNode = rotatedNode(fixed, bestIndex, {
        makeSquare: false,
    });
    bestNode.koppla.rotation = (bestIndex * Math.PI) / 2;
    if (bestIndex === 1 || bestIndex === 3) {
        [bestNode.width, bestNode.height] = [bestNode.height, bestNode.width];
    }
    return bestNode;
}
/**
 * Rotates ports and dimensions (width, height) in PI/2 steps counter
 * clockwise.
 *
 * Now, this is tricky. We want to rotate the node around it's center.
 * The node's origin is always top left and the port positions are relative
 * to the node origin.
 *
 * Optionally, the returned dimensions are always square, and the ports are
 * moved to keep their relative position.
 *
 * @param steps integer number of PI/2 rotations to perform, [0,3].
 * @returns a shallow copy of the given node, with rotated ports and dimensions
 */
function rotatedNode(node, steps, options = { makeSquare: false }) {
    var _a;
    (0, assert_1.strict)(node.x === undefined);
    (0, assert_1.strict)(node.y === undefined);
    (0, assert_1.strict)(node.width !== undefined);
    (0, assert_1.strict)(node.height !== undefined);
    (0, assert_1.strict)(Number.isInteger(steps));
    (0, assert_1.strict)(steps >= 0 && steps <= 3);
    const rotation = (steps * Math.PI) / 2;
    const maxDim = Math.max(node.width, node.height);
    const width = options.makeSquare ? maxDim : node.width;
    const height = options.makeSquare ? maxDim : node.height;
    const xAdjust = options.makeSquare ? (width - node.width) / 2 : 0;
    const yAdjust = options.makeSquare ? (height - node.height) / 2 : 0;
    const originMoves = steps % 2 !== 0 && !options.makeSquare;
    const rotatedNodeOrigin = originMoves
        ? {
            x: (node.width - node.height) / 2,
            y: (node.height - node.width) / 2,
        }
        : { x: 0, y: 0 };
    const rotationReference = {
        x: node.width / 2,
        y: node.height / 2,
    };
    const rotatedPorts = ((_a = node.ports) !== null && _a !== void 0 ? _a : []).map((port) => {
        (0, assert_1.strict)(port.x !== undefined);
        (0, assert_1.strict)(port.y !== undefined);
        const rotatedPoint = rotate({ x: port.x, y: port.y }, rotationReference, rotation);
        rotatedPoint.x += xAdjust - rotatedNodeOrigin.x;
        rotatedPoint.y += yAdjust - rotatedNodeOrigin.y;
        return Object.assign(Object.assign({}, port), rotatedPoint);
    });
    return Object.assign(Object.assign({}, node), { width,
        height, ports: rotatedPorts });
}
function totalPortDistance(fixed, processed) {
    const total = fixed.ports.reduce((sum, fixedPort, index) => {
        (0, assert_1.strict)(processed.ports !== undefined);
        const processedPort = processed.ports[index];
        return sum + distance(fixedPort, processedPort);
    }, 0);
    (0, assert_1.strict)(Number.isFinite(total));
    return total;
}
function rotate(p, reference, rotation) {
    (0, assert_1.strict)(rotation >= 0);
    (0, assert_1.strict)(rotation <= Math.PI * 2);
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
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
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
function renderSVG(layout, font) {
    const svgSymbols = layout.children.reduce((commands, node) => {
        (0, assert_1.strict)(node.x !== undefined);
        (0, assert_1.strict)(node.y !== undefined);
        (0, assert_1.strict)(node.width !== undefined);
        (0, assert_1.strict)(node.height !== undefined);
        const symbol = node.koppla.skin;
        (0, assert_1.strict)(symbol !== undefined);
        const rotation = (node.koppla.rotation * 180) / Math.PI;
        const sourceReference = {
            x: symbol.size.x / 2,
            y: symbol.size.y / 2,
        };
        const targetReference = {
            x: node.x + node.width / 2,
            y: node.y + node.height / 2,
        };
        const translation = {
            x: targetReference.x - sourceReference.x,
            y: targetReference.y - sourceReference.y,
        };
        const figure = `<g transform="
            translate(${round(translation.x)}, ${round(translation.y)})
            rotate(${rotation},${sourceReference.x},${sourceReference.y})
        ">
            ${symbol === null || symbol === void 0 ? void 0 : symbol.svgData}
        </g>`;
        commands.push(figure);
        if (DEBUG) {
            commands.push(`<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`);
        }
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
    const svgJunctions = layout.edges.flatMap((edge) => {
        var _a;
        return (_a = edge.junctionPoints) === null || _a === void 0 ? void 0 : _a.map((point) => {
            const x = round(Number(point.x));
            const y = round(Number(point.y));
            return `<circle cx="${x}" cy="${y}" r="5" style="fill:#000000"/>`;
        });
    });
    const svgLabels = layout.children.flatMap((node) => {
        var _a;
        const labels = (_a = node.labels) !== null && _a !== void 0 ? _a : [];
        return labels.map((label) => {
            const x = round(Number(node.x) + Number(label.x));
            const y = round(Number(node.y) + Number(label.y));
            return (`<text x="${x}" y="${y}" alignment-baseline="hanging" style="fill:#000000;fill-opacity:1;stroke:none">${label.text}</text>` +
                (DEBUG
                    ? `<rect x="${x}" y="${y}" width="${label.width}" height="${label.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`
                    : ""));
        });
    });
    const fontStyle = `
    ${font.dataURL ? `
    @font-face {
        font-family: "Koppla Electric";
        font-style: normal;
        src: url("${font.dataURL}");
    }` : ""}
    text {
        font-family: "Koppla Electric", monospace;
        font-size: ${font.height}px;
        font-weight: normal;
    }
    `;
    return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg width="${layout.width}" height="${layout.height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
        <style>${fontStyle}</style>
        ${svgSymbols.join("")}
        ${svgWires.join("")}
        ${svgJunctions.join("")}
        ${svgLabels.join("")}
        </svg>`;
}
let labelIndex = 0;
function makeLabel(text, fontWidth, fontHeight) {
    return {
        id: `LBL${labelIndex++}`,
        text,
        width: fontWidth * text.length,
        height: fontHeight,
    };
}
function labelsFromNode(node, font) {
    const labels = [];
    if (node.designator !== "GND") {
        labels.push(makeLabel(node.ID, font.width, font.height));
    }
    if (node.description) {
        labels.push(makeLabel(node.description, font.width, font.height));
    }
    if (node.value) {
        labels.push(makeLabel(valueToString(node.value), font.width, font.height));
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