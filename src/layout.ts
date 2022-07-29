import assert from "assert";
import ELK, {
    Node as ELKNode,
    Edge as ELKEdge,
    Port as ELKPort,
    LayoutOptions,
    Label,
} from "elkjs";

import { CompiledNode, CompiledSchematic } from "./compiler";
import { LoadedFont } from "./font";
import { optimize } from "./optimize";
import { NumericValue, Value } from "./parser";
import { Skin, SymbolSkin } from "./skin";

export type KopplaELKNode = ELKNode & {
    koppla: { node: CompiledNode; skin?: SymbolSkin; rotation: number };
};

export type KopplaELKRoot = Omit<ELKNode, "children" | "edges"> &
    Pick<Required<ELKNode>, "edges"> & { children: KopplaELKNode[] };

export async function layout(
    schematic: CompiledSchematic,
    skin: Skin,
    font: LoadedFont,
    options: { optimize: boolean } = {
        optimize: true,
    }
): Promise<ELKNode> {
    const elk = new ELK();

    const nodes: KopplaELKNode[] = schematic.nodes.map((node) => {
        const symbolInfo = node.symbolInfo;
        assert(symbolInfo !== undefined);

        const symbolSkin = skin.findSymbol(symbolInfo);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol "${symbolInfo.ID}" not found in skin`);
        }
        const terminals = symbolSkin.terminals;

        const ports: ELKPort[] = symbolInfo.terminals.map<ELKPort>(
            (terminal) => {
                const portPoint = terminals[terminal];
                if (portPoint === undefined) {
                    throw new Error(
                        `Symbol ${symbolInfo.ID} terminal "${terminal}" not found in skin`
                    );
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
            }
        );

        const width = symbolSkin.size.x;
        const height = symbolSkin.size.y;

        let layoutOptions: Record<string, unknown> = {};
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
            const { x: minX, y: minY } = Skin.minimumBoxSize;
            layoutOptions["elk.nodeSize.minimum"] = `(${minX}, ${minY})`;
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

    const edges: ELKEdge[] = schematic.edges.map((edge, index) => ({
        id: `E${index}`,
        sources: [`${edge.source.ID}:P${edge.sourceTerminal}`],
        targets: [`${edge.target.ID}:P${edge.targetTerminal}`],
    }));

    const graph: KopplaELKRoot = {
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
        }, {} as Record<string, string>);

    // https://www.eclipse.org/elk/reference/algorithms/org-eclipse-elk-layered.html
    const layoutOptions: LayoutOptions = {
        "elk.algorithm": "layered",
        "elk.direction": "DOWN",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.spacing.labelLabel": 3,
        //"elk.layered.layering.strategy": "NETWORK_SIMPLEX",
        "elk.layered.layering.strategy": "LONGEST_PATH",
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        //"elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        "elk.layered.compaction.postCompaction.strategy": "LEFT",
        "elk.edge.thickness": 3.5,
        ...layoutOptionsFromSettings,
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

    const prePass = (await elk.layout(
        cloneWithSkin(graph, skin, { squareBoundingBox: true }),
        {
            layoutOptions,
        }
    )) as KopplaELKRoot;

    if (!options.optimize) {
        return prePass;
    }

    const graphWithSkin = cloneWithSkin(graph, skin, {
        squareBoundingBox: false,
    });

    const optimized = optimize(graphWithSkin, prePass);
    setupLabelPlacements(optimized);

    const laidOut = await elk.layout(optimized, {
        layoutOptions: {
            ...layoutOptions,
            "org.eclipse.elk.portConstraints": "FIXED_POS",
        },
    });

    return laidOut;
}

function labelsFromNode(node: CompiledNode, font: LoadedFont): Label[] {
    const labels: Label[] = [];

    if (node.designator !== "GND") {
        labels.push(makeLabel(node.ID, font.width, font.height));
    }
    if (node.description) {
        labels.push(makeLabel(node.description, font.width, font.height));
    }
    if (node.value) {
        const label = makeLabel(
            valueToString(node.value),
            font.width,
            font.height
        );
        if (node.symbolInfo?.dynamic) {
            label.layoutOptions = {
                "elk.nodeLabels.placement": "INSIDE H_CENTER V_CENTER",
            };
        }
        labels.push(label);
    }
    return labels;
}

let labelIndex = 0;

function makeLabel(text: string, fontWidth: number, fontHeight: number): Label {
    return {
        id: `LBL${labelIndex++}`,
        text,
        width: fontWidth * text.length,
        height: fontHeight,
    };
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
    const ohmega = "\u2126";
    const unit = ["o", "ohm"].includes(value.unit?.toLowerCase()) ? ohmega : "";
    return `${value.value}${prefix || ""}${unit}`;
}

function setupLabelPlacements(graph: KopplaELKRoot) {
    type Edge = "N" | "S" | "E" | "W";

    for (const child of graph.children) {
        assert(child.width !== undefined);
        assert(child.height !== undefined);

        const portEdges: Edge[] = [];

        for (const port of child.ports ?? []) {
            assert(port.x !== undefined);
            assert(port.y !== undefined);

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

        const placements: Record<Edge, string> = {
            N: "OUTSIDE H_CENTER V_TOP",
            S: "OUTSIDE H_CENTER V_BOTTOM",
            E: "OUTSIDE H_RIGHT V_CENTER",
            W: "OUTSIDE H_LEFT V_CENTER",
        };

        const edgePriorities: Edge[] = ["W", "E", "N", "S"];

        for (const edge of edgePriorities) {
            if (!portEdges.includes(edge)) {
                placement = placements[edge];
                break;
            }
        }

        child.layoutOptions = {
            ...child.layoutOptions,
            "org.eclipse.elk.nodeLabels.placement": placement,
        };
    }
}

function cloneWithSkin(
    graph: KopplaELKRoot,
    skin: Skin,
    options: { squareBoundingBox: boolean } = { squareBoundingBox: false }
): KopplaELKRoot {
    const copy = deepCopy(graph);

    for (const child of copy.children ?? []) {
        const symbolInfo = child.koppla.node.symbolInfo;
        assert(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbolInfo.ID} not found in skin`);
        }
        child.koppla.skin = symbolSkin;
        if (options.squareBoundingBox) {
            child.width = Math.max(symbolSkin.size.x, symbolSkin.size.y);
            child.height = child.width;
        } else {
            child.width = symbolSkin.size.x;
            child.height = symbolSkin.size.y;
        }
    }

    return copy;
}

function deepCopy<T>(object: T): T {
    const serialized = JSON.stringify(object);
    const copy = JSON.parse(serialized);
    assert(serialized === JSON.stringify(copy));
    return copy;
}
