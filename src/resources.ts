import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { join } from "path";

export function findResource(path: string): string {
    try {
        const resolved = require.resolve(join("koppla", path));
        if (resolved !== undefined) {
            return resolved;
        }
    } catch (err) {
        // Ignore and move on
    }
    const parent = join(__dirname, "..");
    const rootRelative = join(parent, path);
    if (existsSync(rootRelative)) {
        return rootRelative;
    }

    throw new Error(`Resource "${path}" not found`);
}

export async function loadResource(path: string): Promise<Buffer> {
    const resource = findResource(path);
    return readFile(resource);
}

export async function loadJSONResource<
    T extends Record<string, unknown> = Record<string, unknown>
>(path: string): Promise<T> {
    const resourceData = await loadResource(path);
    const object = JSON.parse(resourceData.toString());
    return object;
}
