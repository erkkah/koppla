export interface SymbolInfo {
    ID: string;
    terminals: string[];
}
export interface SymbolLibrary {
    lookup(symbol: string): SymbolInfo;
}
export declare class CoreSymbols implements SymbolLibrary {
    private symbolInfo;
    constructor(additional?: Record<string, SymbolInfo>);
    lookup(symbol: string): SymbolInfo;
}
