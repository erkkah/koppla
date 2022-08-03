export declare type CommandlineOptions = Record<symbol, number | string | boolean>;
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
export declare function parseArguments<T extends CommandlineOptions>(args: string[], template: T): [T, string[]];
