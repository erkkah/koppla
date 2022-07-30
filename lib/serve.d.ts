export declare function serve(sourceFile: string, port: number, generator: (sourceFile: string) => Promise<{
    content: string;
    type: string;
}>): void;
