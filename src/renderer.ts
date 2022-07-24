import { strict as assert } from "assert";
import ELK, {
    Label,
    Node as ELKNode,
    Edge as ELKEdge,
    Port as ELKPort,
    LayoutOptions,
} from "elkjs";

const DEBUG = false;

import { CompiledSchematic, CompiledNode } from "./compiler";
import { NumericValue, Value } from "./parser";
import { Skin, SymbolSkin, Point } from "./skin";
import { SymbolLibrary } from "./symbols";

type KopplaELKNode = ELKNode & {
    koppla: { node: CompiledNode; skin?: SymbolSkin; rotation: number };
};

type KopplaELKRoot = Omit<ELKNode, "children" | "edges"> &
    Pick<Required<ELKNode>, "edges"> & { children: KopplaELKNode[] };

export async function render(
    schematic: CompiledSchematic,
    symbols: SymbolLibrary,
    skin: Skin,
    options: { optimize: boolean } = { optimize: true }
): Promise<string> {
    const elk = new ELK();

    const nodes: KopplaELKNode[] = schematic.nodes.map((node) => {
        const symbolInfo = symbols.lookup(node.symbol);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
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
                return {
                    id: `${node.ID}:P${terminal}`,
                    x: portPoint.x,
                    y: portPoint.y,
                    width: 0,
                    height: 0,
                };
            }
        );

        const width = symbolSkin.size.x;
        const height = symbolSkin.size.y;

        let layoutOptions: Record<string, unknown> = {};
        if (node.ID.startsWith("GND")) {
            layoutOptions["org.eclipse.elk.layered.layering.layerConstraint"] =
                "LAST";
        }
        if (node.ID.startsWith("V")) {
            layoutOptions["org.eclipse.elk.layered.layering.layerConstraint"] =
                "FIRST";
        }

        return {
            id: node.ID,
            labels: labelsFromNode(node),
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

    // https://www.eclipse.org/elk/reference/algorithms/org-eclipse-elk-layered.html
    const layoutOptions: LayoutOptions = {
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

    const prePass = (await elk.layout(
        cloneWithSkin(graph, symbols, skin, { squareBoundingBox: true }),
        {
            layoutOptions,
        }
    )) as KopplaELKRoot;

    if (!options.optimize) {
        return renderSVG(prePass);
    }

    const graphWithSkin = cloneWithSkin(graph, symbols, skin, {
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

    return renderSVG(laidOut as KopplaELKRoot);
}

function setupLabelPlacements(graph: KopplaELKRoot) {
    type Edge = "N" | "S" | "E" | "W";
    const portEdges: Edge[] = [];

    for (const child of graph.children) {
        assert(child.width !== undefined);
        assert(child.height !== undefined);

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

        let placement = "OUTSIDE";

        if (!portEdges.includes("N")) {
            placement = "OUTSIDE H_CENTER V_TOP";
        } else if (!portEdges.includes("S")) {
            placement = "OUTSIDE H_CENTER V_BOTTOM";
        } else if (!portEdges.includes("E")) {
            placement = "OUTSIDE H_RIGHT V_CENTER";
        } else if (!portEdges.includes("W")) {
            placement = "OUTSIDE H_LEFT V_CENTER";
        }
        child.layoutOptions = {
            ...child.layoutOptions,
            "org.eclipse.elk.nodeLabels.placement": placement,
        };
    }
}

function deepCopy<T>(object: T): T {
    const serialized = JSON.stringify(object);
    const copy = JSON.parse(serialized);
    assert(serialized === JSON.stringify(copy));
    return copy;
}

export function optimize(
    root: KopplaELKRoot,
    preprocessed: KopplaELKRoot
): KopplaELKRoot {
    for (const i in preprocessed.children) {
        const child = preprocessed.children[i];
        root.children[i] = rotateNode(root.children[i], child);
    }
    return root;
}

/**
 * Rotates a node to move ports to an optimal position.
 *
 * @param fixed Unprocessed node
 * @param processed Preprocessed node, laid out with no port restrictions
 * @returns Shallow copy of the fixed node in a rotation which minimizes the
 *  total port distance to the preprocessed node.
 */
function rotateNode(fixed: KopplaELKNode, processed: ELKNode): KopplaELKNode {
    if (fixed.ports === undefined) {
        assert(processed.ports === undefined);
        return fixed;
    }
    assert(fixed.ports.length === processed.ports?.length);

    const rotations = [0, 1, 2, 3];
    const rotatedNodes = rotations.map((rotation) =>
        rotatedNode(fixed, rotation, { makeSquare: true })
    );

    const distances = rotatedNodes.map((node) =>
        totalPortDistance(node, processed)
    );
    let minDistance = Number.MAX_VALUE;
    let minIndex = -1;

    for (let i = 0; i < distances.length; i++) {
        const distance = distances[i];
        if (distance < minDistance) {
            minDistance = distance;
            minIndex = i;
        }
    }

    const bestNode = rotatedNode(fixed, minIndex, {
        makeSquare: false,
    });
    bestNode.koppla.rotation = (rotations[minIndex] * Math.PI) / 2;
    if (minIndex === 1 || minIndex === 3) {
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
function rotatedNode<T extends ELKNode>(
    node: T,
    steps: number,
    options: { makeSquare: boolean } = { makeSquare: false }
): T {
    assert(node.x === undefined);
    assert(node.y === undefined);
    assert(node.width !== undefined);
    assert(node.height !== undefined);
    assert(Number.isInteger(steps));
    assert(steps >= 0 && steps <= 3);

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

    const rotationReference: Point = {
        x: node.width / 2,
        y: node.height / 2,
    };

    const rotatedPorts = (node.ports ?? []).map((port) => {
        assert(port.x !== undefined);
        assert(port.y !== undefined);

        const rotatedPoint = rotate(
            { x: port.x, y: port.y },
            rotationReference,
            rotation
        );
        rotatedPoint.x += xAdjust - rotatedNodeOrigin.x;
        rotatedPoint.y += yAdjust - rotatedNodeOrigin.y;
        return {
            ...port,
            ...rotatedPoint,
        };
    });

    return {
        ...node,
        width,
        height,
        ports: rotatedPorts,
    };
}

function totalPortDistance(fixed: ELKNode, processed: ELKNode): number {
    const total = (fixed.ports as Required<ELKPort>[]).reduce(
        (sum, fixedPort, index) => {
            assert(processed.ports !== undefined);
            const processedPort = processed.ports[index] as Required<ELKPort>;
            return sum + distance(fixedPort, processedPort);
        },
        0
    );
    assert(Number.isFinite(total));
    return total;
}

function rotate(p: Point, reference: Point, rotation: number): Point {
    assert(rotation >= 0);
    assert(rotation <= Math.PI * 2);

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

function distance(a: Point, b: Point): number {
    const xDiff = a.x - b.x;
    const yDiff = a.y - b.y;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}

function cloneWithSkin(
    graph: KopplaELKRoot,
    symbols: SymbolLibrary,
    skin: Skin,
    options: { squareBoundingBox: boolean } = { squareBoundingBox: false }
): KopplaELKRoot {
    const copy = deepCopy(graph);

    for (const child of copy.children ?? []) {
        const symbol = child.koppla.node.symbol;
        const symbolInfo = symbols.lookup(symbol);
        assert(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbol} not found in skin`);
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

function round(value: number | string | undefined): string {
    return String(Math.round(Number(value) * 1000) / 1000);
}

function renderSVG(layout: KopplaELKRoot): string {
    const svgSymbols = layout.children.reduce((commands, node) => {
        assert(node.x !== undefined);
        assert(node.y !== undefined);
        assert(node.width !== undefined);
        assert(node.height !== undefined);

        const symbol = node.koppla.skin;
        assert(symbol !== undefined);

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
            ${symbol?.svgData}
        </g>`;
        commands.push(figure);
        if (DEBUG) {
            commands.push(
                `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`
            );
        }
        return commands;
    }, [] as string[]);

    const svgWires = layout.edges.reduce((commands, edge) => {
        const lines = (edge.sections ?? []).reduce((lines, section) => {
            const points = (section.bendPoints ?? []).concat(section.endPoint);
            const lineTos = points.map((point) => `L${point.x} ${point.y}`);
            lines.push(
                `M${section.startPoint.x} ${
                    section.startPoint.y
                } ${lineTos.join("")}`
            );
            return lines;
        }, [] as string[]);

        const style =
            "fill:none;stroke:#000000;stroke-width:3.5;stroke-linecap:round;stroke-linejoin:miter;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1";
        const wire = `<path d="${lines.join(" ")}" style="${style}"/>`;
        commands.push(wire);
        return commands;
    }, [] as string[]);

    const svgLabels = layout.children.flatMap((node) => {
        const labels = node.labels ?? [];
        return labels.map((label) => {
            const x = round(Number(node.x) + Number(label.x));
            const y = round(Number(node.y) + Number(label.y));
            return (
                `<text x="${x}" y="${y}" alignment-baseline="hanging" style="fill:#000000;fill-opacity:1;stroke:none">${label.text}</text>` +
                (DEBUG
                    ? `<rect x="${x}" y="${y}" width="${label.width}" height="${label.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`
                    : "")
            );
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

function makeLabel(text: string): Label {
    return {
        id: `LBL${labelIndex++}`,
        text,
        // ??? Hack!
        width: 10 * text.length,
        height: 10,
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
