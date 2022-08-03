"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseArguments = void 0;
/**
 * Parses command line arguments into options and file arguments.
 * Accepts options of the type `-arg=value` mixed with non-option
 * (file) arguments. Options can use one or two dashes.
 * Boolean options without value will be set to true,
 * `-help` sets the `help` member to `true`.
 *
 * Example:
 * ```
 *    const template = {
 *        help: false,
 *        count: 42,
 *        color: "black",
 *    };
 *    const [parsed, files] = parseArguments(process.argv.slice(2), template);
 * ```
 *
 * @param args List of arguments to parse, typically `process.argv.slice(2)`
 * @param template Template options object with defaults
 * @returns A tuple with a filled in template copy and a list of non-option arguments
 */
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
            const type = typeof parsed[name];
            const stringValue = options[name];
            let value;
            switch (type) {
                case "string":
                    value = stringValue;
                    break;
                case "number":
                    value = Number(stringValue);
                    break;
                case "boolean":
                    value = !["0", "false", "no"].includes(stringValue.toLowerCase());
                    break;
                default:
                    throw new Error(`Unsupported option type for option "${name}": "${type}"`);
            }
            parsed[name] = value;
        }
    }
    return [parsed, files];
}
exports.parseArguments = parseArguments;
function parseOption(option) {
    const matches = option.match(/^-{1,2}(\w+)(?:=(\S+))?$/);
    if (!matches) {
        throw new Error("Failed to parse option");
    }
    const name = matches[1];
    const value = matches[2] !== undefined ? matches[2] : "true";
    return [name, value];
}
//# sourceMappingURL=args.js.map