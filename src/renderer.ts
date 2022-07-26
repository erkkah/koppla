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
import { defaultFont, LoadedFont, loadFontAsDataURL } from "./font";
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
    options: { optimize: boolean; fontFile?: string; fontSize: number } = {
        optimize: true,
        fontSize: 20,
    }
): Promise<string> {
    const elk = new ELK();

    let font: LoadedFont = defaultFont(options.fontSize);

    if (options.fontFile) {
        font = await loadFontAsDataURL(options.fontFile, options.fontSize);
    }

    const nodes: KopplaELKNode[] = schematic.nodes.map((node) => {
        const symbolInfo = symbols.lookup(node.symbol);
        if (symbolInfo === undefined) {
            throw new Error(`Symbol "${node.symbol}" not found`);
        }
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
        /*
        if (node.designator === "GND") {
            layoutOptions["org.eclipse.elk.layered.layering.layerConstraint"] =
                "LAST";
        }
        */

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
        cloneWithSkin(graph, symbols, skin, { squareBoundingBox: true }),
        {
            layoutOptions,
        }
    )) as KopplaELKRoot;

    if (!options.optimize) {
        return renderSVG(prePass, font, skin);
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

    return renderSVG(laidOut as KopplaELKRoot, font, skin);
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
        const preChild = preprocessed.children[i];
        const child = root.children[i];
        root.children[i] = rotateNode(child, preChild);
    }
    return root;
}

/**
 * Rotates a node to move ports to an optimal position according to a preprocessed graph.
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

    let bestIndex = -1;
    const fixedRotation = fixed.koppla.skin?.options?.rotationSteps;

    if (fixedRotation !== undefined) {
        bestIndex = fixedRotation;
    } else {
        const rotations = [0, 1, 2, 3];
        const rotatedNodes = rotations.map((rotation) =>
            rotatedNode(fixed, rotation, { makeSquare: true })
        );

        const distances = rotatedNodes.map((node) =>
            totalPortDistance(node, processed)
        );
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

function renderSVG(
    layout: KopplaELKRoot,
    font: LoadedFont,
    skin: Skin
): string {
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
        const transforms = [
            `translate(${round(translation.x)}, ${round(translation.y)})`,
        ];
        if (rotation !== 0) {
            transforms.push(
                `rotate(${rotation},${sourceReference.x},${sourceReference.y})`
            );
        }
        const figure = `<g transform="${transforms.join("")}">${
            symbol?.svgData
        }</g>`;
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

        const wire = `<path d="${lines.join(" ")}" class="wire"/>`;
        commands.push(wire);
        return commands;
    }, [] as string[]);

    const svgJunctions = layout.edges.flatMap((edge) => {
        return edge.junctionPoints?.map((point) => {
            const x = round(Number(point.x));
            const y = round(Number(point.y));
            return `<circle cx="${x}" cy="${y}" r="5" style="fill:#000"/>`;
        });
    });

    const svgLabels = layout.children.flatMap((node) => {
        const labels = node.labels ?? [];
        return labels.map((label) => {
            const x = round(Number(node.x) + Number(label.x));
            const y = round(Number(node.y) + Number(label.y));
            return (
                `<text x="${x}" y="${y}" alignment-baseline="hanging">${label.text}</text>` +
                (DEBUG
                    ? `<rect x="${x}" y="${y}" width="${label.width}" height="${label.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`
                    : "")
            );
        });
    });

    const fontStyle = `
    ${
        font.dataURL
            ? `
    @font-face {
        font-family: "Koppla Electric";
        font-style: normal;
        src: url("${font.dataURL}");
    }`
            : ""
    }
    text {
        font-family: "Koppla Electric", monospace;
        font-size: ${font.height}px;
        font-weight: normal;
        fill: #000;
        fill-opacity: 1;
        stroke: none";
    }
    .wire {
        fill:none;
        stroke:#000;
        stroke-width:3.5;
        stroke-linecap:round;
        stroke-linejoin:miter;
        stroke-miterlimit:4;
        stroke-dasharray:none;
        stroke-opacity:1;
    }
    ${skin.styleCache.CSS}
    `;

    return minify(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg width="${layout.width}" height="${
        layout.height
    }" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
        <style>${fontStyle}</style>
        ${svgSymbols.join("\n")}
        ${svgWires.join("\n")}
        ${svgJunctions.join("\n")}
        ${svgLabels.join("\n")}
        </svg>`);
}

function minify(code: string): string {
    const mini = code.replace(/^\s+/gm, "");
    return mini;
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

function labelsFromNode(node: CompiledNode, font: LoadedFont): Label[] {
    const labels: Label[] = [];

    if (node.designator !== "GND") {
        labels.push(makeLabel(node.ID, font.width, font.height));
    }
    if (node.description) {
        labels.push(makeLabel(node.description, font.width, font.height));
    }
    if (node.value) {
        labels.push(
            makeLabel(valueToString(node.value), font.width, font.height)
        );
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
