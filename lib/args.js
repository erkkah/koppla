"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArguments = void 0;
function parseOption(option) {
    const matches = option.match(/^-{1,2}(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches[2] !== undefined ? matches[2] : "true";
    return [name, value];
}
function parseArguments(args, template) {
    const options = {};
    const files = [];
    for (const arg of args) {
        if (arg.startsWith("-")) {
            const [name, value] = parseOption(arg);
            if (!(name in template)) {
                throw new Error(`Unknown option "${name}"`);
            }
            options[name] = value;
        }
        else {
            files.push(arg);
        }
    }
    const parsed = Object.assign({}, template);
    for (const name of Object.keys(template)) {
        if (name in options) {
            parsed[name] = options[name];
        }
    }
    return [parsed, files];
}
exports.parseArguments = parseArguments;
//# sourceMappingURL=args.js.map