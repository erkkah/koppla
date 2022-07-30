import { strict as assert } from "assert";
import { Node as ELKNode, Port as ELKPort } from "elkjs";

import { KopplaELKNode, KopplaELKRoot } from "./layout";
import { Point } from "./skin";

/**
 * Finds the optimal orientation of all nodes with fixed port positions
 * to most closely match the preprocessed version that was laid out without
 * port restrictions.
 */
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

    let flipped = false;
    const flippedNode = hFlipNode(fixed);

    let bestIndex = -1;
    const rotations = fixed.koppla.skin?.options?.rotationSteps ?? [0, 1, 2, 3];

    if (rotations.length === 1) {
        bestIndex = 0;
    } else {
        const rotatedNodes = rotations.map((rotation) =>
            rotatedNode(fixed, rotation, { makeSquare: true })
        );

        let flippedAndRotatedNodes = rotatedNodes.map((node) => hFlipNode(node));

        const distances = [...rotatedNodes, ...flippedAndRotatedNodes].map(
            (node) => totalPortDistance(node, processed)
        );
        let minDistance = Number.MAX_VALUE;

        for (let i = 0; i < distances.length; i++) {
            const distance = distances[i];
            if (distance < minDistance) {
                minDistance = distance;
                bestIndex = i % rotatedNodes.length;
                flipped = i >= rotatedNodes.length;
            }
        }
    }

    const rotationSteps = rotations[bestIndex];
    const bestNode = rotatedNode(flipped ? flippedNode : fixed, rotationSteps, {
        makeSquare: false,
    });
    bestNode.koppla.rotation = (rotationSteps * Math.PI) / 2;
    bestNode.koppla.flip = flipped;
    if (rotationSteps === 1 || rotationSteps === 3) {
        [bestNode.width, bestNode.height] = [bestNode.height, bestNode.width];
    }
    return bestNode;
}

/**
 * Flips the ports of a node horizontally.
 */
function hFlipNode<T extends ELKNode>(node: T): T {
    const flippedPorts = (node.ports ?? []).map((port) => {
        assert(node.width !== undefined);
        assert(port.x !== undefined);

        const flippedX = node.width - port.x;
        return {
            ...port,
            x: flippedX,
        };
    });

    return {
        ...node,
        ports: flippedPorts,
    };
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
    assert(Number.isInteger(steps), `${steps} is not integer`);
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
