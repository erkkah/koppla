export declare class StyleCache {
    readonly prefix: string;
    private readonly styleToClassMap;
    private index;
    constructor(prefix: string);
    styleToClass(style: string): string;
    get CSS(): string;
}
