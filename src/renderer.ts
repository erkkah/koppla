import { strict as assert } from "assert";
import { Node as ELKNode, Label } from "elkjs";

import { CompiledSchematic } from "./compiler";
import { defaultFont, LoadedFont, loadFontFromFile, loadFontFromFont, trimFont } from "./font";
import { KopplaELKRoot, layout } from "./layout";
import { Skin } from "./skin";

export interface RenderOptions {
    optimize: boolean;
    drawBoxes?: boolean;
    fontFile?: string;
    fontSize: number;
}

export async function render(
    schematic: CompiledSchematic,
    skin: Skin,
    options: RenderOptions = {
        optimize: true,
        drawBoxes: false,
        fontSize: 20,
    }
): Promise<string> {
    let font: LoadedFont = defaultFont(options.fontSize);
    
    if (options.fontFile) {
        font = await loadFontFromFile(options.fontFile, options.fontSize);
    }
    const laidOut = await layout(schematic, skin, font, options);
    if (font.font) {
        const usedChars = charsInNode(laidOut);
        font = loadFontFromFont(trimFont(font.font, usedChars), options.fontSize);
    }
    return renderSVG(laidOut as KopplaELKRoot, font, skin, !!options.drawBoxes);
}

function charsInNode(node: ELKNode): string {
    const labels = (node.children ?? []).flatMap((node) => node.labels ?? []);
    const usedChars = new Set<string>;
    for (const label of labels) {
        for (const char of label.text) {
            usedChars.add(char);
        }
    }
    return [...usedChars.keys()].join("");  
}

function round(value: number | string | undefined): string {
    return String(Math.round(Number(value) * 1000) / 1000);
}

function renderSVG(
    layout: KopplaELKRoot,
    font: LoadedFont,
    skin: Skin,
    drawBoxes: boolean,
): string {
    const svgSymbols = layout.children.reduce((commands, node) => {
        assert(node.x !== undefined);
        assert(node.y !== undefined);
        assert(node.width !== undefined);
        assert(node.height !== undefined);

        const symbol = node.koppla.skin;
        assert(symbol !== undefined);

        if (symbol.options?.dynamic) {
            symbol.updateDynamicSize({
                x: Number(node.width),
                y: Number(node.height),
            });
        }

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
                `rotate(${rotation},${round(sourceReference.x)},${round(sourceReference.y)})`
            );
        }
        if (node.koppla.flip) {
            transforms.push(`translate(${round(symbol.size.x)}, 0) scale(-1, 1)`);
        }
        const figure = `<g transform="${transforms.join("")}">${
            symbol?.svgData
        }</g>`;
        commands.push(figure);
        if (drawBoxes) {
            commands.push(
                `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`
            );
        }
        return commands;
    }, [] as string[]);

    const svgWires = layout.edges.reduce((commands, edge) => {
        const lines = (edge.sections ?? []).reduce((lines, section) => {
            const points = (section.bendPoints ?? []).concat(section.endPoint);
            const lineTos = points.map((point) => `L${round(point.x)} ${round(point.y)}`);
            lines.push(
                `M${round(section.startPoint.x)} ${
                    round(section.startPoint.y)
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
            return `<circle cx="${x}" cy="${y}" r="5" class="dot"/>`;
        });
    });

    const svgLabels = layout.children.flatMap((node) => {
        const labels = node.labels ?? [];

        const portLabels = (node.ports ?? []).flatMap((port) =>
            (port.labels ?? []).map<Label>((label) => ({
                ...label,
                x: Number(port.x) + Number(label.x),
                y: Number(port.y) + Number(label.y),
            }))
        );

        return [...labels, ...portLabels].map((label) => {
            const x = round(Number(node.x) + Number(label.x));
            const y = round(Number(node.y) + Number(label.y));
            return (
                `
                <rect x="${x}" y="${y}" width="${label.width}" height="${label.height}" class="textbg"/>
                <text x="${x}" y="${y}">${label.text}</text>
                ` +
                (drawBoxes
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
        stroke: none;
        alignment-baseline: hanging;
    }
    .textbg {
        fill: #FFFFFF;
        fill-opacity: 0.8;
        stroke: none;
    }
    .wire {
        fill:none;
        stroke:#000;
        stroke-width:3.5;
        stroke-linecap:round;
    }
    .dot {
        fill:#000;
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
    const mini = code.replace(/^\s+/gm, "").replace(/[{]([^}]+)[}]/gm, (_all, style: string) => {
        const oneLine = (style?.split("\n") ?? []).join("");
        return `{${oneLine}}`
    });
    return mini;
}
