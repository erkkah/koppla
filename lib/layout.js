"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.layout = void 0;
const assert_1 = __importDefault(require("assert"));
const elkjs_1 = __importDefault(require("elkjs"));
const optimize_1 = require("./optimize");
const skin_1 = require("./skin");
async function layout(schematic, skin, font, options = {
    optimize: true,
}) {
    const elk = new elkjs_1.default();
    const nodes = schematic.nodes.map((node) => {
        const symbolInfo = node.symbolInfo;
        (0, assert_1.default)(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol "${symbolInfo.ID}" not found in skin`);
        }
        const terminals = symbolSkin.terminals;
        const ports = symbolInfo.terminals.map((terminal) => {
            const portPoint = terminals[terminal];
            if (portPoint === undefined) {
                throw new Error(`Symbol ${symbolInfo.ID} terminal "${terminal}" not found in skin`);
            }
            const labels = symbolInfo.dynamic
                ? [makeLabel(terminal, font.width, font.height)]
                : undefined;
            return {
                id: `${node.ID}:P${terminal}`,
                x: portPoint.x,
                y: portPoint.y,
                width: 0,
                height: 0,
                labels,
            };
        });
        const width = symbolSkin.size.x;
        const height = symbolSkin.size.y;
        let layoutOptions = {};
        if (node.designator === "GND") {
            layoutOptions["elk.layered.layering.layerConstraint"] = "LAST";
        }
        if (symbolInfo.dynamic) {
            layoutOptions["elk.portConstraints"] = "FREE";
            layoutOptions["elk.portLabels.placement"] =
                "INSIDE NEXT_TO_PORT_IF_POSSIBLE";
            layoutOptions["elk.nodeSize.options"] =
                "COMPUTE_PADDING ASYMMETRICAL";
            layoutOptions["elk.nodeSize.constraints"] =
                "PORTS PORT_LABELS NODE_LABELS MINIMUM_SIZE";
            const { x: minX, y: minY } = skin_1.Skin.minimumBoxSize;
            layoutOptions["elk.nodeSize.minimum"] = `(${minX}, ${minY})`;
        }
        return {
            id: node.ID,
            labels: labelsFromNode(node, font),
            width,
            height,
            koppla: { node, rotation: 0, flip: false },
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
    const layoutOptionsFromSettings = Object.entries(schematic.settings)
        .filter(([key]) => key.startsWith("elk."))
        .reduce((settings, setting) => {
        const [key, value] = setting;
        settings[key] = value;
        return settings;
    }, {});
    // https://www.eclipse.org/elk/reference/algorithms/org-eclipse-elk-layered.html
    const layoutOptions = Object.assign({ "elk.algorithm": "layered", "elk.direction": "DOWN", "elk.edgeRouting": "ORTHOGONAL", "elk.spacing.labelLabel": 3, "elk.layered.layering.strategy": "LONGEST_PATH", "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF", "elk.layered.nodePlacement.bk.fixedAlignment": "RIGHTDOWN", "elk.layered.compaction.postCompaction.strategy": "LEFT", "elk.edge.thickness": 3.5 }, layoutOptionsFromSettings);
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
    const prePass = (await elk.layout(cloneWithSkin(graph, skin, { squareBoundingBox: true }), {
        layoutOptions,
    }));
    if (!options.optimize) {
        return prePass;
    }
    const graphWithSkin = cloneWithSkin(graph, skin, {
        squareBoundingBox: false,
    });
    const optimized = (0, optimize_1.optimize)(graphWithSkin, prePass);
    setupLabelPlacements(optimized);
    const laidOut = await elk.layout(optimized, {
        layoutOptions: Object.assign(Object.assign({}, layoutOptions), { "org.eclipse.elk.portConstraints": "FIXED_POS" }),
    });
    return laidOut;
}
exports.layout = layout;
function labelsFromNode(node, font) {
    var _a;
    const labels = [];
    if (node.designator !== "GND") {
        labels.push(makeLabel(node.ID, font.width, font.height));
    }
    if (node.description) {
        labels.push(makeLabel(node.description, font.width, font.height));
    }
    if (node.value) {
        const label = makeLabel(valueToString(node.value), font.width, font.height);
        if ((_a = node.symbolInfo) === null || _a === void 0 ? void 0 : _a.dynamic) {
            label.layoutOptions = {
                "elk.nodeLabels.placement": "INSIDE H_CENTER V_CENTER",
            };
        }
        labels.push(label);
    }
    return labels;
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
function valueToString(value) {
    switch (value.type) {
        case "NumericValue":
            (0, assert_1.default)(value.type === "NumericValue");
            return formatValue(value);
        case "SymbolicValue":
            (0, assert_1.default)(value.type === "SymbolicValue");
            return value.value;
        default:
            (0, assert_1.default)(false, "Unhandled value type");
    }
}
function formatValue(value) {
    var _a;
    const prefix = value.prefix === "u" ? "µ" : value.prefix;
    const ohmega = "\u2126";
    const unit = ["o", "ohm"].includes((_a = value.unit) === null || _a === void 0 ? void 0 : _a.toLowerCase()) ? ohmega : "";
    return `${value.value}${prefix || ""}${unit}`;
}
function setupLabelPlacements(graph) {
    var _a, _b, _c;
    for (const child of graph.children) {
        (0, assert_1.default)(child.width !== undefined);
        (0, assert_1.default)(child.height !== undefined);
        const portEdges = [];
        let placement = "OUTSIDE H_LEFT V_TOP";
        if (!((_b = (_a = child.koppla.skin) === null || _a === void 0 ? void 0 : _a.options) === null || _b === void 0 ? void 0 : _b.dynamic)) {
            for (const port of (_c = child.ports) !== null && _c !== void 0 ? _c : []) {
                (0, assert_1.default)(port.x !== undefined);
                (0, assert_1.default)(port.y !== undefined);
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
            const placements = {
                N: "OUTSIDE H_CENTER V_TOP",
                S: "OUTSIDE H_CENTER V_BOTTOM",
                E: "OUTSIDE H_RIGHT V_CENTER",
                W: "OUTSIDE H_LEFT V_CENTER",
            };
            const edgePriorities = ["W", "E", "N", "S"];
            for (const edge of edgePriorities) {
                if (!portEdges.includes(edge)) {
                    placement = placements[edge];
                    break;
                }
            }
        }
        child.layoutOptions = Object.assign(Object.assign({}, child.layoutOptions), { "org.eclipse.elk.nodeLabels.placement": placement });
    }
}
function cloneWithSkin(graph, skin, options = { squareBoundingBox: false }) {
    var _a;
    const copy = deepCopy(graph);
    for (const child of (_a = copy.children) !== null && _a !== void 0 ? _a : []) {
        const symbolInfo = child.koppla.node.symbolInfo;
        (0, assert_1.default)(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbolInfo.ID} not found in skin`);
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
function deepCopy(object) {
    const serialized = JSON.stringify(object);
    const copy = JSON.parse(serialized);
    (0, assert_1.default)(serialized === JSON.stringify(copy));
    return copy;
}
//# sourceMappingURL=layout.js.map