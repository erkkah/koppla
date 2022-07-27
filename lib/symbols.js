"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreSymbols = void 0;
const assert = require("assert");
const resources_1 = require("./resources");
class CoreSymbols {
    constructor(symbolInfo) {
        this.symbolInfo = symbolInfo;
        for (const info of Object.values(this.symbolInfo)) {
            assert(info.terminals.length >= 1);
        }
    }
    lookup(symbol) {
        return this.symbolInfo[symbol.toUpperCase()];
    }
    static async load(path) {
        const symbols = await (0, resources_1.loadJSONResource)(path);
        return new CoreSymbols(symbols);
    }
}
exports.CoreSymbols = CoreSymbols;
//# sourceMappingURL=symbols.js.map