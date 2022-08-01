function parseOption(option: string): [string, string] {
    const matches = option.match(/^-{1,2}(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches[2] !== undefined ? matches[2] : "true";
    return [name, value];
}

export type CommandlineOptions = Record<symbol, number | string | boolean>;

export function parseArguments<T extends CommandlineOptions>(args: string[], template: T): [T, string[]]{
    const options: Record<string, string> = {};
    const files: string[] = [];

    for (const arg of args) {
        if (arg.startsWith("-")) {
            const [name, value] = parseOption(arg);
            if (!(name in template)) {
                throw new Error(`Unknown option "${name}"`)
            }
            options[name] = value;
        } else {
            files.push(arg);
        }
    }

    const parsed: Record<string, number | string | boolean> = {
        ...template
    };

    for (const name of Object.keys(template)) {
        if (name in options) {
            parsed[name] = options[name];
        }
    }

    return [parsed as T, files];
}
