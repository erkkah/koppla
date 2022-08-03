"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.portPlacements = exports.lockPortPlacements = exports.optimize = void 0;
const assert_1 = require("assert");
/**
 * Finds the optimal orientation of all nodes with fixed port positions
 * to most closely match the preprocessed version that was laid out without
 * port restrictions.
 */
function optimize(root, preprocessed) {
    for (const i in preprocessed.children) {
        const preChild = preprocessed.children[i];
        const child = root.children[i];
        root.children[i] = rotateNode(child, preChild);
    }
    return root;
}
exports.optimize = optimize;
function lockPortPlacements(preprocessed) {
    var _a;
    for (const child of preprocessed.children) {
        if (((_a = child.ports) === null || _a === void 0 ? void 0 : _a.length) === 2) {
            const placements = new Set(portPlacements(child));
            if (placements.size === 1) {
                const [placement] = placements.values();
                if (placement === "N" || placement === "S") {
                    // We have a two port node with all ports placed north or south.
                    // Lock ports to the east and west to hint better part rotation.
                    child.layoutOptions = Object.assign(Object.assign({}, child.layoutOptions), { "elk.portConstraints": "FIXED_SIDE" });
                    const [a, b] = child.ports;
                    (0, assert_1.strict)(a.x !== undefined);
                    (0, assert_1.strict)(b.x !== undefined);
                    const westToEast = a.x < b.x;
                    child.ports[0].layoutOptions = Object.assign(Object.assign({}, child.ports[0].layoutOptions), { "elk.port.side": westToEast ? "WEST" : "EAST" });
                    child.ports[1].layoutOptions = Object.assign(Object.assign({}, child.ports[1].layoutOptions), { "elk.port.side": westToEast ? "EAST" : "WEST" });
                }
            }
        }
    }
}
exports.lockPortPlacements = lockPortPlacements;
function portPlacements(node) {
    var _a;
    const portEdges = [];
    const jnd = 1e-6;
    const closeEnough = (a, b) => Math.abs(a - b) < jnd;
    for (const port of (_a = node.ports) !== null && _a !== void 0 ? _a : []) {
        (0, assert_1.strict)(port.x !== undefined);
        (0, assert_1.strict)(port.y !== undefined);
        (0, assert_1.strict)(node.width !== undefined);
        (0, assert_1.strict)(node.height !== undefined);
        if (closeEnough(port.x, 0)) {
            portEdges.push("W");
            continue;
        }
        if (closeEnough(port.x, node.width)) {
            portEdges.push("E");
            continue;
        }
        if (closeEnough(port.y, 0)) {
            portEdges.push("N");
            continue;
        }
        if (closeEnough(port.y, node.height)) {
            portEdges.push("S");
            continue;
        }
        (0, assert_1.strict)(false, "Unexpected port position");
    }
    return portEdges;
}
exports.portPlacements = portPlacements;
/**
 * Rotates a node to move ports to an optimal position according to a preprocessed graph.
 *
 * @param fixed Unprocessed node
 * @param processed Preprocessed node, laid out with no port restrictions
 * @returns Shallow copy of the fixed node in a rotation which minimizes the
 *  total port distance to the preprocessed node.
 */
function rotateNode(fixed, processed) {
    var _a, _b, _c, _d;
    if (fixed.ports === undefined) {
        (0, assert_1.strict)(processed.ports === undefined);
        return fixed;
    }
    (0, assert_1.strict)(fixed.ports.length === ((_a = processed.ports) === null || _a === void 0 ? void 0 : _a.length));
    let flipped = false;
    const flippedNode = hFlipNode(fixed);
    let bestIndex = -1;
    const rotations = (_d = (_c = (_b = fixed.koppla.skin) === null || _b === void 0 ? void 0 : _b.options) === null || _c === void 0 ? void 0 : _c.rotationSteps) !== null && _d !== void 0 ? _d : [0, 1, 2, 3];
    if (rotations.length === 1) {
        bestIndex = 0;
    }
    else {
        const rotatedNodes = rotations.map((rotation) => rotatedNode(fixed, rotation, { makeSquare: true }));
        let flippedAndRotatedNodes = rotatedNodes.map((node) => hFlipNode(node));
        const distances = [...rotatedNodes, ...flippedAndRotatedNodes].map((node) => totalPortDistance(node, processed));
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
function hFlipNode(node) {
    var _a;
    const flippedPorts = ((_a = node.ports) !== null && _a !== void 0 ? _a : []).map((port) => {
        (0, assert_1.strict)(node.width !== undefined);
        (0, assert_1.strict)(port.x !== undefined);
        const flippedX = node.width - port.x;
        return Object.assign(Object.assign({}, port), { x: flippedX });
    });
    return Object.assign(Object.assign({}, node), { ports: flippedPorts });
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
function rotatedNode(node, steps, options = { makeSquare: false }) {
    var _a;
    (0, assert_1.strict)(node.x === undefined);
    (0, assert_1.strict)(node.y === undefined);
    (0, assert_1.strict)(node.width !== undefined);
    (0, assert_1.strict)(node.height !== undefined);
    (0, assert_1.strict)(Number.isInteger(steps), `${steps} is not integer`);
    (0, assert_1.strict)(steps >= 0 && steps <= 3);
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
    const rotationReference = {
        x: node.width / 2,
        y: node.height / 2,
    };
    const rotatedPorts = ((_a = node.ports) !== null && _a !== void 0 ? _a : []).map((port) => {
        (0, assert_1.strict)(port.x !== undefined);
        (0, assert_1.strict)(port.y !== undefined);
        const rotatedPoint = rotate({ x: port.x, y: port.y }, rotationReference, rotation);
        rotatedPoint.x += xAdjust - rotatedNodeOrigin.x;
        rotatedPoint.y += yAdjust - rotatedNodeOrigin.y;
        return Object.assign(Object.assign({}, port), rotatedPoint);
    });
    return Object.assign(Object.assign({}, node), { width,
        height, ports: rotatedPorts });
}
function totalPortDistance(fixed, processed) {
    const total = fixed.ports.reduce((sum, fixedPort, index) => {
        (0, assert_1.strict)(processed.ports !== undefined);
        const processedPort = processed.ports[index];
        return sum + distance(fixedPort, processedPort);
    }, 0);
    (0, assert_1.strict)(Number.isFinite(total));
    return total;
}
function rotate(p, reference, rotation) {
    (0, assert_1.strict)(rotation >= 0);
    (0, assert_1.strict)(rotation <= Math.PI * 2);
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
function distance(a, b) {
    const xDiff = a.x - b.x;
    const yDiff = a.y - b.y;
    return Math.sqrt(xDiff * xDiff + yDiff * yDiff);
}
//# sourceMappingURL=optimize.js.map