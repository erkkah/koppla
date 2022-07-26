export class StyleCache {
    private readonly styleToClassMap: Record<string, string> = {};
    private index = 0;

    constructor(readonly prefix: string){}

    public styleToClass(style: string): string {
        const normalized = normalizedStyle(style);
        if (normalized in this.styleToClassMap) {
            return this.styleToClassMap[normalized];
        }
        const classID = `${this.prefix}${this.index++}`;
        this.styleToClassMap[normalized] = classID;
        return classID;
    }

    public get CSS(): string {
        return Object.entries(this.styleToClassMap).map(([style, cls]) => {
            return `.${cls}{${style}}`;
        }).join("\n");
    }
}

function normalizedStyle(style: string): string {
    // Cheapo CSS parsing
    const statements = style.trim().split(";");
    const styleMap = statements.reduce((map, statement) => {
        const [key, value,] = statement.split(":");
        map[key] = value;
        return map;
    }, {} as Record<string, string>);
    const sortedKeys = Object.keys(styleMap).sort();
    const normalized = sortedKeys.reduce((list, key) => {
        list.push(`${key}:${styleMap[key]}`);
        return list;
    }, [] as string[]);
    return normalized.join(";") + ";";
}
