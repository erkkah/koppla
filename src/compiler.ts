import assert = require("assert");
import {
    Schematic,
    Statement,
    ConnectionStatement,
    Definition,
    Component,
    Port,
    Node,
    Value,
    Settings,
} from "./parser";
import { SymbolLibrary } from "./symbols";

interface NodeID {
    ID: string;
    resolved: boolean;
}

interface CompiledPort {
    ID: NodeID;
    kind: string;
    symbol?: string;
}

type CompiledDefinition = Pick<Definition, "description" | "symbol" | "value"> &
    Required<Pick<Definition, "designator">>;

interface CompiledConnection {
    source: NodeID;
    target: NodeID;
    sourceTerminal?: string;
    targetTerminal?: string;
    sourceFlipped?: boolean;
    targetFlipped?: boolean;
}

export interface CompiledNode {
    ID: string;
    designator: string;
    symbol: string;
    description?: string;
    value?: Value;
}

export class CompiledSchematic {
    private ports: CompiledPort[] = [];
    private components: Array<CompiledDefinition & { ID: NodeID }> = [];
    private connections: CompiledConnection[] = [];
    readonly settings: Record<string, string> = {};
    private unresolvedIndex = -1;
    private resolved = false;

    private getNodes(): CompiledNode[] {
        const portNodes: CompiledNode[] = this.ports.map((port) => ({
            ID: port.ID.ID,
            designator: port.kind,
            symbol: port.symbol ?? port.kind,
        }));

        const componentNodes: CompiledNode[] = this.components.map(
            (component) => ({
                ID: component.ID.ID,
                designator: component.designator.designator,
                symbol: component.symbol ?? component.designator.designator,
                description: component.description,
                value: component.value,
            })
        );

        return [...portNodes, ...componentNodes];
    }

    get nodes(): CompiledNode[] {
        assert(this.resolved, "Must resolve before fetching nodes");

        return this.getNodes();
    }

    get edges(): Required<CompiledConnection>[] {
        assert(this.resolved, "Must resolve before fetching edges");

        return this.connections as Required<CompiledConnection>[];
    }

    component(definition: CompiledDefinition): NodeID {
        this.resolved = false;

        const designator = definition.designator;
        let resolved = true;

        let found: typeof this.components[0] | undefined = undefined;

        if (isNaN(designator.index)) {
            designator.index = this.unresolvedIndex--;
            resolved = false;
        }

        const ID = `${designator.designator}${designator.index || ""}`;
        const nodeID: NodeID = {
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
        } else {
            this.components.push({ ...definition, ID: nodeID });
        }

        return nodeID;
    }

    port(port: Port): NodeID {
        this.resolved = false;

        const ID = portID(port);
        const nodeID: NodeID = {
            ID,
            resolved: true,
        };
        const found = this.ports.find((p) => p.ID.ID === ID);
        if (!found) {
            this.ports.push({
                kind: port.kind,
                symbol: port.symbol,
                ID: nodeID,
            });
        }
        return nodeID;
    }

    connection(
        source: NodeID,
        target: NodeID,
        sourceTerminal?: string,
        targetTerminal?: string,
        sourceFlipped?: boolean,
        targetFlipped?: boolean
    ) {
        this.resolved = false;

        this.connections.push({
            source,
            target,
            sourceTerminal,
            targetTerminal,
            sourceFlipped,
            targetFlipped
        });
    }

    settingsList(settings: Settings["settings"]) {
        for (const setting of settings) {
            this.settings[setting.key] = setting.value;
        }
    }

    resolve(symbols: SymbolLibrary) {
        const unresolved = this.components.filter((c) => !c.ID.resolved);

        const unresolvedByType = unresolved.reduce((map, c) => {
            const type = c.designator.designator;
            const componentsOfType = map[type] || [];
            componentsOfType.push(c);
            map[type] = componentsOfType;
            return map;
        }, {} as Record<string, Array<typeof this.components[0]>>);

        const maxIndices = Object.keys(unresolvedByType).reduce((map, type) => {
            const componentsOfType = this.components.filter(
                (c) => c.designator.designator === type
            );
            const componentIndices = componentsOfType
                .map((c) => c?.designator.index)
                .filter((i) => i > 0);
            const maxIndex = componentIndices.length
                ? Math.max(...componentIndices)
                : 0;
            map[type] = maxIndex;
            return map;
        }, {} as Record<string, number>);

        for (const [type, unresolved] of Object.entries(unresolvedByType)) {
            let index = maxIndices[type] ?? 0;
            for (const component of unresolved) {
                assert(
                    component.designator.index < 0,
                    "Unresolved should have negative index"
                );
                index++;
                component.designator.index = index;
                component.ID.ID = `${type}${index}`;
                component.ID.resolved = true;
            }
        }

        const nodes = this.getNodes();
        const nodeSymbol = (ID: string) => {
            const found = nodes.find((node) => node.ID === ID);
            if (found) {
                const symbolInfo = symbols.lookup(found.symbol);
                if (symbolInfo === undefined) {
                    throw new Error(
                        `Symbol "${found.symbol}" not found for ${ID}`
                    );
                }
                return symbolInfo;
            }
            assert(false, "Node not found while resolving connections");
        };

        for (const connection of this.connections) {
            const sourceSymbol = nodeSymbol(connection.source.ID);
            assert(sourceSymbol.terminals.length >= 1);
            const sourceTerminal =
                connection.sourceTerminal ??
                (sourceSymbol.terminals.length > 1
                    ? sourceSymbol.terminals[connection.sourceFlipped ? 0 : 1]
                    : sourceSymbol.terminals[0]);

            const targetSymbol = nodeSymbol(connection.target.ID);
            assert(targetSymbol.terminals.length >= 1);
            assert(!connection.targetFlipped || targetSymbol.terminals.length >= 2);
            const targetTerminal =
                connection.targetTerminal ?? targetSymbol.terminals[connection.targetFlipped ? 1 : 0];

            if (!sourceSymbol.terminals.includes(sourceTerminal)) {
                throw new Error(
                    `Terminal ${sourceTerminal} not found in symbol ${sourceSymbol.ID}`
                );
            }

            if (!targetSymbol.terminals.includes(targetTerminal)) {
                throw new Error(
                    `Terminal ${targetTerminal} not found in symbol ${targetSymbol.ID}`
                );
            }

            connection.sourceTerminal = sourceTerminal;
            connection.targetTerminal = targetTerminal;
        }

        this.resolved = true;
    }
}

function portID(port: Port): string {
    if (port.specifier == undefined) {
        return port.kind;
    }
    return `${port.kind}:${port.specifier}`;
}

export function compile(
    schematic: Schematic,
    symbols: SymbolLibrary
): CompiledSchematic {
    assert(schematic.type === "Schematic");
    const statements = schematic.body;
    const compiled = new CompiledSchematic();
    for (const statement of statements) {
        compileStatement(compiled, statement);
    }
    compiled.resolve(symbols);
    return compiled;
}

function compileStatement(schematic: CompiledSchematic, statement: Statement) {
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

function compileConnection(
    schematic: CompiledSchematic,
    connection: ConnectionStatement
) {
    assert(connection.type === "Connection");

    const source = connection.source;
    let [sourceID, sourceFlipped] = compileNode(schematic, source);

    for (const c of connection.connections) {
        const [targetID, targetFlipped] = compileNode(schematic, c.target);
        schematic.connection(
            sourceID,
            targetID,
            c.sourceTerminal,
            c.targetTerminal,
            sourceFlipped,
            targetFlipped,
        );
        sourceID = targetID;
    }
}

function compileNode(schematic: CompiledSchematic, node: Node): [NodeID, boolean] {
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

function compileComponent(
    schematic: CompiledSchematic,
    component: Component
): [NodeID, boolean] {
    assert(component.type === "Component");
    const type = componentTypeFromDelimiters(component.open, component.close);
    return [compileDefinition(schematic, component.definition, type), type?.flipped ?? false];
}

interface ComponentType {
    type: string;
    symbol?: string;
    flipped?: boolean;
}

function componentTypeFromDelimiters(
    open: string,
    close: string
): ComponentType | undefined {
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

function compilePort(schematic: CompiledSchematic, port: Port): NodeID {
    assert(port.type === "Port");
    return schematic.port(port);
}

function compileDefinition(
    schematic: CompiledSchematic,
    definition: Definition,
    typeFromSymbol?: ComponentType
): NodeID {
    assert(definition.type === "Definition");
    const designator =
        definition.designator?.designator ?? typeFromSymbol?.type;

    if (designator === undefined) {
        throw new Error("Designator required");
    }

    if (typeFromSymbol !== undefined && designator !== typeFromSymbol.type) {
        throw new Error(
            `Mismatched component type ${designator} != ${typeFromSymbol.type}`
        );
    }

    const index = definition.designator?.index ?? NaN;
    const symbol = typeFromSymbol?.symbol;

    return schematic.component({
        ...definition,
        symbol: definition.symbol || symbol,
        designator: {
            designator,
            index,
        },
    });
}

function compileSettings(schematic: CompiledSchematic, settings: Settings) {
    assert(settings.type === "Settings");
    schematic.settingsList(settings.settings);
}
