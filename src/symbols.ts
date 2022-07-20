import assert = require("assert");
import symbols from "./symbols.json";

export interface SymbolInfo {
    ID: string;
    terminals: string[];
}

export interface SymbolLibrary {
    lookup(symbol: string): SymbolInfo;
}

export class CoreSymbols implements SymbolLibrary {
    private symbolInfo: Record<string, SymbolInfo> = symbols;

    constructor(additional?: Record<string, SymbolInfo>) {
        if (additional !== undefined) {
            this.symbolInfo = {
                ...this.symbolInfo,
                ...additional,
            };
        }

        for (const info of Object.values(this.symbolInfo)) {
            assert(info.terminals.length >= 1);
        }
    }

    lookup(symbol: string): SymbolInfo {
        return this.symbolInfo[symbol];
    }
}
