export declare type CommandlineOptions = Record<symbol, number | string | boolean>;
export declare function parseArguments<T extends CommandlineOptions>(args: string[], template: T): [T, string[]];
