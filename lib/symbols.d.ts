export interface SymbolInfo {
    ID: string;
    terminals: string[];
}
export interface SymbolLibrary {
    lookup(symbol: string): SymbolInfo;
}
export declare class CoreSymbols implements SymbolLibrary {
    readonly symbolInfo: Record<string, SymbolInfo>;
    constructor(symbolInfo: Record<string, SymbolInfo>);
    lookup(symbol: string): SymbolInfo;
    static load(path: string): Promise<CoreSymbols>;
}
