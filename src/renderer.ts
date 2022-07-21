import { strict as assert } from "assert";
import ELK, {
    Label,
    Node as ELKNode,
    Edge as ELKEdge,
    Port as ELKPort,
} from "elkjs";

import { CompiledSchematic, CompiledNode } from "./compiler";
import { NumericValue, Value } from "./parser";
import { Skin, SymbolSkin } from "./skin";
import { SymbolLibrary } from "./symbols";

type KopplaELKNode = ELKNode & {
    koppla: { node: CompiledNode; skin?: SymbolSkin };
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
            koppla: { node },
            ports,
        };
    });

    const edges: ELKEdge[] = schematic.edges.map((edge, index) => ({
        id: `E${index}`,
        sources: [`${edge.source.ID}:P${edge.sourceTerminal}`],
        targets: [`${edge.target.ID}:P${edge.targetTerminal}`],
    }));

    const root: KopplaELKRoot = {
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
            "org.eclipse.elk.nodeLabels.placement":"OUTSIDE H_CENTER V_TOP",
        },
    });

    return renderSVG(laidOut as KopplaELKRoot);
}

function setupFromSkin(
    layout: KopplaELKRoot,
    symbols: SymbolLibrary,
    skin: Skin
) {
    for (const child of layout.children ?? []) {
        const symbol = child.koppla.node.symbol;
        const symbolInfo = symbols.lookup(symbol);
        assert(symbolInfo !== undefined);
        const symbolSkin = skin.findSymbol(symbolInfo.ID);
        if (symbolSkin === undefined) {
            throw new Error(`Symbol ${symbol} not found in skin`);
        }
        child.koppla.skin = symbolSkin;
        child.width = symbolSkin.size.x;
        child.height = symbolSkin.size.y;
    }
}

function round(value: number | string | undefined): string {
    return String(Math.round(Number(value) * 1000) / 1000);
}

function renderSVG(layout: KopplaELKRoot): string {
    const svgSymbols = layout.children.reduce((commands, node) => {
        const symbol = node.koppla.skin;
        const figure = `<g transform="translate(${round(node.x)}, ${round(
            node.y
        )})">${symbol?.svgData}</g>`;
        commands.push(figure);
        return commands;
    }, [] as string[]);

    const svgWires = layout.edges.reduce((commands, edge) => {
        const lines = (edge.sections ?? []).reduce((lines, section) => {
            const points = (section.bendPoints ?? []).concat(section.endPoint);
            const lineTos = points.map((point) => `L${point.x} ${point.y}`);
            lines.push(
                `M${section.startPoint.x} ${section.startPoint.y} ${lineTos.join("")}`
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
            return `<text x="${x}" y="${y}" style="fill:#000000;fill-opacity:1;stroke:none">${label.text}</text>`
        }
        );
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
