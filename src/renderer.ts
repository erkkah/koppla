import { strict as assert } from "assert";
import { Label } from "elkjs";

const DEBUG = false;

import { CompiledSchematic } from "./compiler";
import { defaultFont, LoadedFont, loadFontAsDataURL } from "./font";
import { KopplaELKRoot, layout } from "./layout";
import { Skin } from "./skin";

export async function render(
    schematic: CompiledSchematic,
    skin: Skin,
    options: { optimize: boolean; fontFile?: string; fontSize: number } = {
        optimize: true,
        fontSize: 20,
    }
): Promise<string> {
    let font: LoadedFont = defaultFont(options.fontSize);
    if (options.fontFile) {
        font = await loadFontAsDataURL(options.fontFile, options.fontSize);
    }
    const laidOut = await layout(schematic, skin, font, options);
    return renderSVG(laidOut as KopplaELKRoot, font, skin);
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
                `rotate(${rotation},${sourceReference.x},${sourceReference.y})`
            );
        }
        if (node.koppla.flip) {
            transforms.push(`translate(${round(symbol.size.x)}, 0) scale(-1, 1)`);
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
                <text x="${x}" y="${y}" alignment-baseline="hanging">${label.text}</text>
                ` +
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
        stroke: none;
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
