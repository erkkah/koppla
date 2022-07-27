/// <reference types="node" />
export declare function findResource(path: string): string;
export declare function loadResource(path: string): Promise<Buffer>;
export declare function loadJSONResource<T extends Record<string, unknown> = Record<string, unknown>>(path: string): Promise<T>;
