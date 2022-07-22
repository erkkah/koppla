import { strict as assert } from "assert";
import ELK, {
    Label,
    Node as ELKNode,
    Edge as ELKEdge,
    Port as ELKPort,
    LayoutOptions,
} from "elkjs";

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
    skin: Skin
): Promise<string> {
    const elk = new ELK();

    const nodes: KopplaELKNode[] = schematic.nodes.map((node) => {
        const symbolInfo = symbols.lookup(node.symbol);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbolInfo.ID} not found in skin`);
        }
        const terminals = symbolSkin.terminals;

        const ports: ELKPort[] = symbolInfo.terminals.map<ELKPort>(
            (terminal) => {
                const portPoint = terminals[terminal];
                if (portPoint === undefined) {
                    throw new Error(
                        `Symbol ${symbolInfo.ID} terminal ${terminal} not found in skin`
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

        return {
            id: node.ID,
            labels: labelsFromNode(node),
            width: symbolSkin.size.x,
            height: symbolSkin.size.y,
            koppla: { node, rotation: 0 },
            ports,
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
        "org.eclipse.elk.nodeLabels.placement": "OUTSIDE H_LEFT V_TOP",
    };

    const prePass = (await elk.layout(cloneWithSkin(graph, symbols, skin, {squareBoundingBox: true}), {
        layoutOptions,
    })) as KopplaELKRoot;

    const optimized = optimize(cloneWithSkin(graph, symbols, skin, {squareBoundingBox: true}), prePass);

    const laidOut = await elk.layout(optimized, {
        layoutOptions: {
            ...layoutOptions,
            "org.eclipse.elk.portConstraints": "FIXED_POS",
        },
    });

    return renderSVG(laidOut as KopplaELKRoot);
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

function rotateNode(fixed: KopplaELKNode, processed: ELKNode): KopplaELKNode {
    if (fixed.ports === undefined) {
        assert(processed.ports === undefined);
        return fixed;
    }
    assert(fixed.ports.length === processed.ports?.length);

    const rotations = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    const rotatedNodes = rotations.map((rotation) =>
        rotatedNode(fixed, rotation)
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

    const bestNode = rotatedNodes[minIndex];
    bestNode.koppla.rotation = rotations[minIndex];
    if (minIndex === 1 || minIndex === 3) {
        [bestNode.width, bestNode.height] = [bestNode.height, bestNode.width];
    }
    return bestNode;
}

function rotatedNode<T extends ELKNode>(node: T, rotation: number): T {
    assert(node.width !== undefined);
    assert(node.height !== undefined);

    const reference: Point = {
        x: node.width / 2,
        y: node.height / 2,
    };

    const rotatedPorts = (node.ports ?? []).map((port) => {
        assert(port.x !== undefined);
        assert(port.y !== undefined);

        const rotatedPoint = rotate(
            { x: port.x, y: port.y },
            reference,
            rotation
        );
        return {
            ...port,
            ...rotatedPoint,
        };
    });

    return {
        ...node,
        ports: rotatedPorts,
    };
}

function totalPortDistance(fixed: ELKNode, processed: ELKNode): number {
    return (fixed.ports as Required<ELKPort>[]).reduce(
        (sum, fixedPort, index) => {
            assert(processed.ports !== undefined);
            const processedPort = processed.ports[index] as Required<ELKPort>;
            return sum + distance(fixedPort, processedPort);
        },
        0
    );
}

function rotate(p: Point, reference: Point, rotation: number): Point {
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
    return Math.sqrt((xDiff * xDiff) + (yDiff * yDiff));
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
        const symbol = node.koppla.skin;
        assert(symbol !== undefined);
        const rotation = (node.koppla.rotation * 180) / Math.PI;
        const reference = Math.max(symbol.size.x, symbol.size.y) / 2;
        const figure = `<g transform="
            translate(${round(node.x)}, ${round(node.y)})
            rotate(${rotation},${reference},${reference})
        ">
            ${symbol?.svgData}
        </g>`;
        commands.push(figure);
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
