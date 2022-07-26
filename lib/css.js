"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StyleCache = void 0;
class StyleCache {
    constructor(prefix) {
        this.prefix = prefix;
        this.styleToClassMap = {};
        this.index = 0;
    }
    styleToClass(style) {
        const normalized = normalizedStyle(style);
        if (normalized in this.styleToClassMap) {
            return this.styleToClassMap[normalized];
        }
        const classID = `${this.prefix}${this.index++}`;
        this.styleToClassMap[normalized] = classID;
        return classID;
    }
    get CSS() {
        return Object.entries(this.styleToClassMap).map(([style, cls]) => {
            return `.${cls}{${style}}`;
        }).join("\n");
    }
}
exports.StyleCache = StyleCache;
function normalizedStyle(style) {
    // Cheapo CSS parsing
    const statements = style.trim().split(";");
    const styleMap = statements.reduce((map, statement) => {
        const [key, value,] = statement.split(":");
        map[key] = value;
        return map;
    }, {});
    const sortedKeys = Object.keys(styleMap).sort();
    const normalized = sortedKeys.reduce((list, key) => {
        list.push(`${key}:${styleMap[key]}`);
        return list;
    }, []);
    return normalized.join(";") + ";";
}
//# sourceMappingURL=css.js.map