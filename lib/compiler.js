"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compile = exports.CompiledSchematic = void 0;
const assert = require("assert");
class CompilationError extends Error {
    constructor(message, location) {
        super(message);
        this.location = location;
        Object.setPrototypeOf(this, CompilationError.prototype);
        this.name = "Compilation Error";
        this.stack = `${this.message}${"\n"} at ${this.location.source}:${this.location.start.line}:${this.location.start.column}`;
    }
    toString() {
        return this.stack;
    }
}
class CompiledSchematic {
    constructor() {
        this.ports = [];
        this.components = [];
        this.connections = [];
        this.settings = {};
        this.unresolvedIndex = -1;
        this.resolved = false;
    }
    getNodes() {
        const portNodes = this.ports.map((port) => {
            var _a;
            return ({
                ID: port.ID.ID,
                designator: port.kind,
                symbol: (_a = port.symbol) !== null && _a !== void 0 ? _a : port.kind,
                location: port.location,
                symbolInfo: port.symbolInfo,
            });
        });
        const componentNodes = this.components.map((component) => {
            var _a;
            return ({
                ID: component.ID.ID,
                designator: component.designator.designator,
                symbol: (_a = component.symbol) !== null && _a !== void 0 ? _a : component.designator.designator,
                description: component.description,
                value: component.value,
                location: component.location,
                symbolInfo: component.symbolInfo,
            });
        });
        return [...portNodes, ...componentNodes];
    }
    get nodes() {
        assert(this.resolved, "Must resolve before fetching nodes");
        return this.getNodes();
    }
    get edges() {
        assert(this.resolved, "Must resolve before fetching edges");
        // Networks are named by the first [source, terminal] that connects
        const terminalToNetwork = new Map();
        const unique = [];
        for (const connection of this.connections) {
            const sourceTerminal = `${connection.source.ID}:${connection.sourceTerminal}`;
            const targetTerminal = `${connection.target.ID}:${connection.targetTerminal}`;
            const sourceNetwork = terminalToNetwork.get(sourceTerminal);
            const targetNetwork = terminalToNetwork.get(targetTerminal);
            if (sourceNetwork === undefined && targetNetwork === undefined) {
                // new network!
                terminalToNetwork.set(sourceTerminal, [
                    connection.source,
                    connection.sourceTerminal,
                ]);
                terminalToNetwork.set(targetTerminal, [
                    connection.target,
                    connection.targetTerminal,
                ]);
                unique.push(connection);
            }
            else if (sourceNetwork === undefined) {
                // add source to target network
                assert(targetNetwork !== undefined);
                terminalToNetwork.set(sourceTerminal, targetNetwork);
                unique.push(Object.assign(Object.assign({}, connection), { target: targetNetwork[0], targetTerminal: targetNetwork[1] }));
            }
            else if (targetNetwork === undefined) {
                // add target to source network
                assert(sourceNetwork !== undefined);
                terminalToNetwork.set(targetTerminal, sourceNetwork);
                unique.push(Object.assign(Object.assign({}, connection), { source: sourceNetwork[0], sourceTerminal: sourceNetwork[1] }));
            }
            else {
                assert(sourceNetwork !== undefined);
                assert(targetNetwork !== undefined);
                if (sourceNetwork !== targetNetwork) {
                    // New connection, merge networks
                    for (const [terminal, network,] of terminalToNetwork.entries()) {
                        if (network === targetNetwork) {
                            terminalToNetwork.set(terminal, sourceNetwork);
                        }
                    }
                    unique.push(Object.assign(Object.assign({}, connection), { source: sourceNetwork[0], sourceTerminal: sourceNetwork[1], target: targetNetwork[0], targetTerminal: targetNetwork[1] }));
                }
                else {
                    // Existing connection, skip
                }
            }
        }
        const seen = new Set();
        return unique.filter((connection) => {
            const sourceTerminal = `${connection.source.ID}:${connection.sourceTerminal}`;
            const targetTerminal = `${connection.target.ID}:${connection.targetTerminal}`;
            const connID = `${sourceTerminal}-${targetTerminal}`;
            if (seen.has(connID)) {
                return false;
            }
            seen.add(connID);
            return true;
        });
    }
    component(definition) {
        this.resolved = false;
        const designator = definition.designator;
        let resolved = true;
        let found = undefined;
        if (isNaN(designator.index)) {
            designator.index = this.unresolvedIndex--;
            resolved = false;
        }
        const ID = `${designator.designator}${designator.index || ""}`;
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
        this.resolved = false;
        const ID = portID(port);
        const nodeID = {
            ID,
            resolved: true,
        };
        const found = this.ports.find((p) => p.ID.ID === ID);
        if (!found) {
            this.ports.push({
                kind: port.kind,
                symbol: port.symbol,
                ID: nodeID,
                location: port.location,
            });
        }
        return nodeID;
    }
    connection(connection) {
        this.resolved = false;
        this.connections.push(connection);
    }
    settingsList(settings) {
        for (const setting of settings) {
            this.settings[setting.key] = setting.value;
        }
    }
    resolve(symbols) {
        var _a, _b, _c, _d, _e;
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
            const maxIndex = componentIndices.length
                ? Math.max(...componentIndices)
                : 0;
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
        for (const component of this.components) {
            const symbol = (_b = component.symbol) !== null && _b !== void 0 ? _b : component.designator.designator;
            if (symbol === "U") {
                // Special case
                component.symbolInfo = {
                    ID: symbol,
                    terminals: [],
                    dynamic: true,
                };
            }
            else {
                const symbolInfo = symbols.lookup(symbol);
                if (symbolInfo === undefined) {
                    throw new Error(`Symbol "${symbol}" not found for ${component.ID.ID}`);
                }
                component.symbolInfo = symbolInfo;
            }
        }
        for (const port of this.ports) {
            const symbolInfo = symbols.lookup((_c = port.symbol) !== null && _c !== void 0 ? _c : port.kind);
            if (symbolInfo === undefined) {
                throw new Error(`Symbol "${port.symbol}" not found for ${port.ID}`);
            }
            port.symbolInfo = symbolInfo;
        }
        const nodes = this.getNodes();
        const nodeSymbol = (ID) => {
            const found = nodes.find((node) => node.ID === ID);
            if (found) {
                assert(found.symbolInfo !== undefined);
                return found.symbolInfo;
            }
            assert(false, "Node not found while resolving connections");
        };
        for (const connection of this.connections) {
            try {
                const sourceSymbol = nodeSymbol(connection.source.ID);
                let sourceTerminal = "";
                if (sourceSymbol.dynamic) {
                    if (connection.sourceTerminal == null) {
                        throw new Error(`Terminal must be specified for connection from ${connection.source.ID}`);
                    }
                    sourceTerminal = connection.sourceTerminal;
                    sourceSymbol.terminals.push(sourceTerminal);
                }
                else {
                    assert(sourceSymbol.terminals.length >= 1);
                    sourceTerminal =
                        (_d = connection.sourceTerminal) !== null && _d !== void 0 ? _d : (sourceSymbol.terminals.length > 1
                            ? sourceSymbol.terminals[connection.sourceFlipped ? 0 : 1]
                            : sourceSymbol.terminals[0]);
                }
                const targetSymbol = nodeSymbol(connection.target.ID);
                let targetTerminal = "";
                if (targetSymbol.dynamic) {
                    if (connection.targetTerminal == null) {
                        throw new Error(`Terminal must be specified for connection to ${connection.target.ID}`);
                    }
                    targetTerminal = connection.targetTerminal;
                    targetSymbol.terminals.push(targetTerminal);
                }
                else {
                    assert(targetSymbol.terminals.length >= 1);
                    assert(!connection.targetFlipped ||
                        targetSymbol.terminals.length >= 2);
                    targetTerminal =
                        (_e = connection.targetTerminal) !== null && _e !== void 0 ? _e : targetSymbol.terminals[connection.targetFlipped ? 1 : 0];
                }
                if (!sourceSymbol.terminals.includes(sourceTerminal)) {
                    throw new Error(`Terminal "${sourceTerminal}" not found in symbol "${sourceSymbol.ID}"`);
                }
                if (!targetSymbol.terminals.includes(targetTerminal)) {
                    throw new Error(`Terminal "${targetTerminal}" not found in symbol "${targetSymbol.ID}"`);
                }
                assert(sourceTerminal !== undefined);
                assert(targetTerminal !== undefined);
                connection.sourceTerminal = sourceTerminal;
                connection.targetTerminal = targetTerminal;
            }
            catch (err) {
                throw new CompilationError(err.message, connection.location);
            }
        }
        this.resolved = true;
    }
}
exports.CompiledSchematic = CompiledSchematic;
function portID(port) {
    if (port.specifier == undefined) {
        return port.kind;
    }
    return `${port.kind}:${port.specifier}`;
}
function compile(schematic, symbols) {
    assert(schematic.type === "Schematic");
    const statements = schematic.body;
    const compiled = new CompiledSchematic();
    for (const statement of statements) {
        compileStatement(compiled, statement);
    }
    compiled.resolve(symbols);
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
        case "Settings":
            compileSettings(schematic, statement);
            break;
        default:
            assert(false, "Unhandled statement");
    }
}
function compileConnection(schematic, connection) {
    assert(connection.type === "Connection");
    const source = connection.source;
    let [sourceID, sourceFlipped] = compileNode(schematic, source);
    for (const c of connection.connections) {
        const [targetID, targetFlipped] = compileNode(schematic, c.target);
        schematic.connection({
            source: sourceID,
            target: targetID,
            sourceTerminal: c.sourceTerminal,
            targetTerminal: c.targetTerminal,
            sourceFlipped,
            targetFlipped,
            location: c.location,
        });
        sourceID = targetID;
        sourceFlipped = targetFlipped;
    }
}
function compileNode(schematic, node) {
    switch (node.type) {
        case "Component":
            assert(node.type === "Component");
            return compileComponent(schematic, node);
        case "Port":
            assert(node.type === "Port");
            return [compilePort(schematic, node), false];
        default:
            assert(false, "Unhandled source");
    }
}
function compileComponent(schematic, component) {
    var _a;
    assert(component.type === "Component");
    const type = componentTypeFromDelimiters(component.open, component.close);
    return [
        compileDefinition(schematic, component.definition, type),
        (_a = type === null || type === void 0 ? void 0 : type.flipped) !== null && _a !== void 0 ? _a : false,
    ];
}
function componentTypeFromDelimiters(open, close) {
    switch (open) {
        case "[":
            if (close === "]") {
                return { type: "R" };
            }
            if (close === "|") {
                return { type: "C", symbol: "CPOL" };
            }
            if (close === "<") {
                return { type: "D", symbol: "DTUN", flipped: true };
            }
            break;
        case "|":
            if (close === "|") {
                return { type: "C" };
            }
            if (close === "]") {
                return { type: "C", symbol: "CPOL", flipped: true };
            }
            if (close === "<") {
                return { type: "D", flipped: true };
            }
            break;
        case ">":
            if (close === "|") {
                return { type: "D" };
            }
            if (close === "]") {
                return { type: "D", symbol: "DTUN" };
            }
            if (close === "/") {
                return { type: "D", symbol: "DZEN" };
            }
            break;
        case "(":
            if (close === ")") {
                return { type: "Q" };
            }
            break;
        case "$":
            if (close === "$") {
                return { type: "L" };
            }
            break;
        case "/":
            if (close === "/") {
                return { type: "U" };
            }
            if (close === "<") {
                return { type: "D", symbol: "DZEN", flipped: true };
            }
            break;
        case "*":
            if (close === "*") {
                return undefined;
            }
    }
    assert(false, "Invalid component");
}
function compilePort(schematic, port) {
    assert(port.type === "Port");
    return schematic.port(port);
}
function compileDefinition(schematic, definition, typeFromSymbol) {
    var _a, _b, _c, _d;
    assert(definition.type === "Definition");
    const designator = (_b = (_a = definition.designator) === null || _a === void 0 ? void 0 : _a.designator) !== null && _b !== void 0 ? _b : typeFromSymbol === null || typeFromSymbol === void 0 ? void 0 : typeFromSymbol.type;
    if (designator === undefined) {
        throw new Error("Designator required");
    }
    if (typeFromSymbol !== undefined && designator !== typeFromSymbol.type) {
        throw new CompilationError(`Mismatched component type ${designator} != ${typeFromSymbol.type}`, definition.location);
    }
    const index = (_d = (_c = definition.designator) === null || _c === void 0 ? void 0 : _c.index) !== null && _d !== void 0 ? _d : NaN;
    const symbol = typeFromSymbol === null || typeFromSymbol === void 0 ? void 0 : typeFromSymbol.symbol;
    return schematic.component(Object.assign(Object.assign({}, definition), { symbol: definition.symbol || symbol, designator: {
            designator,
            index,
        } }));
}
function compileSettings(schematic, settings) {
    assert(settings.type === "Settings");
    schematic.settingsList(settings.settings);
}
//# sourceMappingURL=compiler.js.map