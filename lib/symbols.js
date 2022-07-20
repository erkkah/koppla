"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoreSymbols = void 0;
const assert = require("assert");
const symbols_json_1 = __importDefault(require("./symbols.json"));
class CoreSymbols {
    constructor(additional) {
        this.symbolInfo = symbols_json_1.default;
        if (additional !== undefined) {
            this.symbolInfo = Object.assign(Object.assign({}, this.symbolInfo), additional);
        }
        for (const info of Object.values(this.symbolInfo)) {
            assert(info.terminals.length >= 1);
        }
    }
    lookup(symbol) {
        return this.symbolInfo[symbol];
    }
}
exports.CoreSymbols = CoreSymbols;
//# sourceMappingURL=symbols.js.map