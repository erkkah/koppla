import { existsSync } from "fs";
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
