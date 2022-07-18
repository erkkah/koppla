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
} from "./parser";

interface NodeID {
    ID: string;
    resolved: boolean;
}

interface CompiledPort {
    kind: string;
    ID: NodeID;
}

type CompiledDefinition = Pick<Definition, "description" | "symbol" | "value"> &
    Required<Pick<Definition, "designator">>;

interface CompiledConnection {
    source: NodeID;
    target: NodeID;
    sourceTerminal?: string;
    targetTerminal?: string;
}

export interface CompiledNode {
    ID: string;
    symbol: string;
    description?: string;
    value?: Value;
}

export class CompiledSchematic {
    private ports: CompiledPort[] = [];
    private components: Array<CompiledDefinition & { ID: NodeID }> = [];
    private connections: CompiledConnection[] = [];
    private unresolvedIndex = -1;

    get nodes(): CompiledNode[] {
        const portNodes: CompiledNode[] = this.ports.map((port) => ({
            ID: port.ID.ID,
            symbol: port.kind,
        }));

        const componentNodes: CompiledNode[] = this.components.map(
            (component) => ({
                ID: component.ID.ID,
                symbol: component.symbol ?? component.designator.designator,
                description: component.description,
                value: component.value,
            })
        );

        return [...portNodes, ...componentNodes];
    }

    get edges(): CompiledConnection[] {
        return this.connections;
    }

    component(definition: CompiledDefinition): NodeID {
        const designator = definition.designator;
        let resolved = true;

        let found: typeof this.components[0] | undefined = undefined;

        if (isNaN(designator.index)) {
            designator.index = this.unresolvedIndex--;
            resolved = false;
        }

        const ID = `${designator.designator}${designator.index}`;
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
        const ID = portID(port);
        const nodeID: NodeID = {
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

    connection(
        source: NodeID,
        target: NodeID,
        sourceTerminal?: string,
        targetTerminal?: string
    ) {
        this.connections.push({
            source,
            target,
            sourceTerminal,
            targetTerminal,
        });
    }

    resolve() {
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
            const maxIndex = componentIndices.length ? Math.max(...componentIndices) : 0;
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
    }
}

function portID(port: Port): string {
    if (port.specifier === undefined) {
        return port.identifier;
    }
    return `${port.identifier}:${port.specifier}`;
}

export function compile(schematic: Schematic): CompiledSchematic {
    assert(schematic.type === "Schematic");
    const statements = schematic.body;
    const compiled = new CompiledSchematic();
    for (const statement of statements) {
        compileStatement(compiled, statement);
    }
    compiled.resolve();
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
    let sourceID = compileNode(schematic, source);

    for (const c of connection.connections) {
        const targetID = compileNode(schematic, c.target);
        schematic.connection(
            sourceID,
            targetID,
            c.sourceTerminal,
            c.targetTerminal
        );
        sourceID = targetID;
    }
}

function compileNode(schematic: CompiledSchematic, node: Node): NodeID {
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

function compileComponent(
    schematic: CompiledSchematic,
    component: Component
): NodeID {
    assert(component.type === "Component");
    const type = componentTypeFromDelimiters(component.open, component.close);
    return compileDefinition(schematic, component.definition, type);
}

function componentTypeFromDelimiters(
    open: string,
    close: string
): string | undefined {
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

function compilePort(schematic: CompiledSchematic, port: Port): NodeID {
    assert(port.type === "Port");
    return schematic.port(port);
}

function compileDefinition(
    schematic: CompiledSchematic,
    definition: Definition,
    fallbackType?: string
): NodeID {
    assert(definition.type === "Definition");
    const designator = definition.designator?.designator ?? fallbackType;
    const index = definition.designator?.index ?? NaN;
    assert(designator !== undefined, "Expected designator");
    return schematic.component({
        ...definition,
        designator: {
            designator,
            index,
        },
    });
}
