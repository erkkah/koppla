"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadJSONResource = exports.loadResource = exports.findResource = void 0;
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const path_1 = require("path");
function findResource(path) {
    try {
        const resolved = require.resolve((0, path_1.join)("koppla", path));
        if (resolved !== undefined) {
            return resolved;
        }
    }
    catch (err) {
        // Ignore and move on
    }
    const parent = (0, path_1.join)(__dirname, "..");
    const rootRelative = (0, path_1.join)(parent, path);
    if ((0, fs_1.existsSync)(rootRelative)) {
        return rootRelative;
    }
    throw new Error(`Resource "${path}" not found`);
}
exports.findResource = findResource;
async function loadResource(path) {
    const resource = findResource(path);
    return (0, promises_1.readFile)(resource);
}
exports.loadResource = loadResource;
async function loadJSONResource(path) {
    const resourceData = await loadResource(path);
    const object = JSON.parse(resourceData.toString());
    return object;
}
exports.loadJSONResource = loadJSONResource;
//# sourceMappingURL=resources.js.map