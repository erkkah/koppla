"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.render = void 0;
const assert_1 = require("assert");
const DEBUG = false;
const font_1 = require("./font");
const layout_1 = require("./layout");
async function render(schematic, skin, options = {
    optimize: true,
    fontSize: 20,
}) {
    let font = (0, font_1.defaultFont)(options.fontSize);
    if (options.fontFile) {
        font = await (0, font_1.loadFontFromFile)(options.fontFile, options.fontSize);
    }
    const laidOut = await (0, layout_1.layout)(schematic, skin, font, options);
    if (font.font) {
        const usedChars = charsInNode(laidOut);
        font = (0, font_1.loadFontFromFont)((0, font_1.trimFont)(font.font, usedChars), options.fontSize);
    }
    return renderSVG(laidOut, font, skin);
}
exports.render = render;
function charsInNode(node) {
    var _a;
    const labels = ((_a = node.children) !== null && _a !== void 0 ? _a : []).flatMap((node) => { var _a; return (_a = node.labels) !== null && _a !== void 0 ? _a : []; });
    const usedChars = new Set;
    for (const label of labels) {
        for (const char of label.text) {
            usedChars.add(char);
        }
    }
    return [...usedChars.keys()].join("");
}
function round(value) {
    return String(Math.round(Number(value) * 1000) / 1000);
}
function renderSVG(layout, font, skin) {
    const svgSymbols = layout.children.reduce((commands, node) => {
        var _a;
        (0, assert_1.strict)(node.x !== undefined);
        (0, assert_1.strict)(node.y !== undefined);
        (0, assert_1.strict)(node.width !== undefined);
        (0, assert_1.strict)(node.height !== undefined);
        const symbol = node.koppla.skin;
        (0, assert_1.strict)(symbol !== undefined);
        if ((_a = symbol.options) === null || _a === void 0 ? void 0 : _a.dynamic) {
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
            transforms.push(`rotate(${rotation},${round(sourceReference.x)},${round(sourceReference.y)})`);
        }
        if (node.koppla.flip) {
            transforms.push(`translate(${round(symbol.size.x)}, 0) scale(-1, 1)`);
        }
        const figure = `<g transform="${transforms.join("")}">${symbol === null || symbol === void 0 ? void 0 : symbol.svgData}</g>`;
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
            const lineTos = points.map((point) => `L${round(point.x)} ${round(point.y)}`);
            lines.push(`M${round(section.startPoint.x)} ${round(section.startPoint.y)} ${lineTos.join("")}`);
            return lines;
        }, []);
        const wire = `<path d="${lines.join(" ")}" class="wire"/>`;
        commands.push(wire);
        return commands;
    }, []);
    const svgJunctions = layout.edges.flatMap((edge) => {
        var _a;
        return (_a = edge.junctionPoints) === null || _a === void 0 ? void 0 : _a.map((point) => {
            const x = round(Number(point.x));
            const y = round(Number(point.y));
            return `<circle cx="${x}" cy="${y}" r="5" class="dot"/>`;
        });
    });
    const svgLabels = layout.children.flatMap((node) => {
        var _a, _b;
        const labels = (_a = node.labels) !== null && _a !== void 0 ? _a : [];
        const portLabels = ((_b = node.ports) !== null && _b !== void 0 ? _b : []).flatMap((port) => {
            var _a;
            return ((_a = port.labels) !== null && _a !== void 0 ? _a : []).map((label) => (Object.assign(Object.assign({}, label), { x: Number(port.x) + Number(label.x), y: Number(port.y) + Number(label.y) })));
        });
        return [...labels, ...portLabels].map((label) => {
            const x = round(Number(node.x) + Number(label.x));
            const y = round(Number(node.y) + Number(label.y));
            return (`
                <rect x="${x}" y="${y}" width="${label.width}" height="${label.height}" class="textbg"/>
                <text x="${x}" y="${y}" alignment-baseline="hanging">${label.text}</text>
                ` +
                (DEBUG
                    ? `<rect x="${x}" y="${y}" width="${label.width}" height="${label.height}" style="fill:none;stroke:#000000;stroke-width:1;"/>`
                    : ""));
        });
    });
    const fontStyle = `
    ${font.dataURL
        ? `
    @font-face {
        font-family: "Koppla Electric";
        font-style: normal;
        src: url("${font.dataURL}");
    }`
        : ""}
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
    .dot {
        fill:#000;
    }
    ${skin.styleCache.CSS}
    `;
    return minify(`<?xml version="1.0" encoding="UTF-8" standalone="no"?>
        <svg width="${layout.width}" height="${layout.height}" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
        <style>${fontStyle}</style>
        ${svgSymbols.join("\n")}
        ${svgWires.join("\n")}
        ${svgJunctions.join("\n")}
        ${svgLabels.join("\n")}
        </svg>`);
}
function minify(code) {
    const mini = code.replace(/^\s+/gm, "");
    return mini;
}
//# sourceMappingURL=renderer.js.map