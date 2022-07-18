"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = exports.CompiledSchematic = void 0;
const assert = require("assert");
class CompiledSchematic {
    constructor() {
        this.ports = [];
        this.components = [];
        this.connections = [];
        this.unresolvedIndex = -1;
    }
    get nodes() {
        const portNodes = this.ports.map((port) => ({
            ID: port.ID.ID,
            symbol: port.kind,
        }));
        const componentNodes = this.components.map((component) => {
            var _a;
            return ({
                ID: component.ID.ID,
                symbol: (_a = component.symbol) !== null && _a !== void 0 ? _a : component.designator.designator,
                description: component.description,
                value: component.value,
            });
        });
        return [...portNodes, ...componentNodes];
    }
    get edges() {
        return this.connections;
    }
    component(definition) {
        const designator = definition.designator;
        let resolved = true;
        let found = undefined;
        if (isNaN(designator.index)) {
            designator.index = this.unresolvedIndex--;
            resolved = false;
        }
        const ID = `${designator.designator}${designator.index}`;
        const nodeID = {
            ID,
            resolved,
        };
        if (resolved) {
            found = this.components.find((c) => c.ID.ID === ID);
        }
        if (found) {
            if (definition.description) {
                found.description = definition.description;
            }
            if (definition.symbol) {
                found.symbol = definition.symbol;
            }
            if (definition.value) {
                found.value = definition.value;
            }
        }
        else {
            this.components.push(Object.assign(Object.assign({}, definition), { ID: nodeID }));
        }
        return nodeID;
    }
    port(port) {
        const ID = portID(port);
        const nodeID = {
            ID,
            resolved: true,
        };
        const found = this.ports.find((p) => p.ID.ID === ID);
        if (!found) {
            this.ports.push({
                kind: port.identifier,
                ID: nodeID,
            });
        }
        return nodeID;
    }
    connection(source, target, sourceTerminal, targetTerminal) {
        this.connections.push({
            source,
            target,
            sourceTerminal,
            targetTerminal,
        });
    }
    resolve() {
        var _a;
        const unresolved = this.components.filter((c) => !c.ID.resolved);
        const unresolvedByType = unresolved.reduce((map, c) => {
            const type = c.designator.designator;
            const componentsOfType = map[type] || [];
            componentsOfType.push(c);
            map[type] = componentsOfType;
            return map;
        }, {});
        const maxIndices = Object.keys(unresolvedByType).reduce((map, type) => {
            const componentsOfType = this.components.filter((c) => c.designator.designator === type);
            const componentIndices = componentsOfType
                .map((c) => c === null || c === void 0 ? void 0 : c.designator.index)
                .filter((i) => i > 0);
            const maxIndex = componentIndices.length ? Math.max(...componentIndices) : 0;
            map[type] = maxIndex;
            return map;
        }, {});
        for (const [type, unresolved] of Object.entries(unresolvedByType)) {
            let index = (_a = maxIndices[type]) !== null && _a !== void 0 ? _a : 0;
            for (const component of unresolved) {
                assert(component.designator.index < 0, "Unresolved should have negative index");
                index++;
                component.designator.index = index;
                component.ID.ID = `${type}${index}`;
                component.ID.resolved = true;
            }
        }
    }
}
exports.CompiledSchematic = CompiledSchematic;
function portID(port) {
    if (port.specifier === undefined) {
        return port.identifier;
    }
    return `${port.identifier}:${port.specifier}`;
}
function compile(schematic) {
    assert(schematic.type === "Schematic");
    const statements = schematic.body;
    const compiled = new CompiledSchematic();
    for (const statement of statements) {
        compileStatement(compiled, statement);
    }
    compiled.resolve();
    return compiled;
}
exports.compile = compile;
function compileStatement(schematic, statement) {
    switch (statement.type) {
        case "Connection":
            compileConnection(schematic, statement);
            break;
        case "Definition":
            compileDefinition(schematic, statement);
            break;
        default:
            assert(false, "Unhandled statement");
    }
}
function compileConnection(schematic, connection) {
    assert(connection.type === "Connection");
    const source = connection.source;
    let sourceID = compileNode(schematic, source);
    for (const c of connection.connections) {
        const targetID = compileNode(schematic, c.target);
        schematic.connection(sourceID, targetID, c.sourceTerminal, c.targetTerminal);
        sourceID = targetID;
    }
}
function compileNode(schematic, node) {
    switch (node.type) {
        case "Component":
            assert(node.type === "Component");
            return compileComponent(schematic, node);
        case "Port":
            assert(node.type === "Port");
            return compilePort(schematic, node);
        default:
            assert(false, "Unhandled source");
    }
}
function compileComponent(schematic, component) {
    assert(component.type === "Component");
    const type = componentTypeFromDelimiters(component.open, component.close);
    return compileDefinition(schematic, component.definition, type);
}
function componentTypeFromDelimiters(open, close) {
    switch (open) {
        case "[":
            if (close === "]") {
                return "R";
            }
            if (close === "|") {
                return "C";
            }
            break;
        case "|":
            if (close === "|") {
                return "C";
            }
            break;
        case ">":
            if (close === "|" || close === "]" || close === "/") {
                return "D";
            }
            break;
        case "(":
            if (close === ")") {
                return "Q";
            }
            break;
        case "$":
            if (close === "$") {
                return "L";
            }
            break;
        case "/":
            if (close === "/") {
                return "U";
            }
            break;
        case ":":
            if (close === ":") {
                return undefined;
            }
    }
    assert(false, "Invalid component");
}
function compilePort(schematic, port) {
    assert(port.type === "Port");
    return schematic.port(port);
}
function compileDefinition(schematic, definition, fallbackType) {
    var _a, _b, _c, _d;
    assert(definition.type === "Definition");
    const designator = (_b = (_a = definition.designator) === null || _a === void 0 ? void 0 : _a.designator) !== null && _b !== void 0 ? _b : fallbackType;
    const index = (_d = (_c = definition.designator) === null || _c === void 0 ? void 0 : _c.index) !== null && _d !== void 0 ? _d : NaN;
    assert(designator !== undefined, "Expected designator");
    return schematic.component(Object.assign(Object.assign({}, definition), { designator: {
            designator,
            index,
        } }));
}
