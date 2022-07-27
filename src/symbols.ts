import assert = require("assert");
import { loadJSONResource } from "./resources";

export interface SymbolInfo {
    ID: string;
    terminals: string[];
}

export interface SymbolLibrary {
    lookup(symbol: string): SymbolInfo;
}

export class CoreSymbols implements SymbolLibrary {

    constructor(readonly symbolInfo: Record<string, SymbolInfo>) {
        for (const info of Object.values(this.symbolInfo)) {
            assert(info.terminals.length >= 1);
        }
    }

    lookup(symbol: string): SymbolInfo {
        return this.symbolInfo[symbol.toUpperCase()];
    }

    static async load(path: string): Promise<CoreSymbols> {
        const symbols = await loadJSONResource<Record<string, SymbolInfo>>(path);
        return new CoreSymbols(symbols);
    }
}
