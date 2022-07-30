"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serve = void 0;
const promises_1 = require("fs/promises");
const http_1 = require("http");
function serve(sourceFile, port, generator) {
    let updated = Date.now();
    (async () => {
        var e_1, _a;
        const watcher = (0, promises_1.watch)(sourceFile, { recursive: false });
        try {
            for (var watcher_1 = __asyncValues(watcher), watcher_1_1; watcher_1_1 = await watcher_1.next(), !watcher_1_1.done;) {
                const _ = watcher_1_1.value;
                const stats = await (0, promises_1.stat)(sourceFile);
                updated = stats.mtime.getTime();
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (watcher_1_1 && !watcher_1_1.done && (_a = watcher_1.return)) await _a.call(watcher_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
    })();
    const server = (0, http_1.createServer)(async (req, res) => {
        var _a;
        const url = new URL((_a = req.url) !== null && _a !== void 0 ? _a : "", `http://${req.headers.host}`);
        if (url.searchParams.has("lastUpdated")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                updated,
            }));
            return;
        }
        try {
            const { content, type } = await generator(sourceFile);
            res.writeHead(200, { "Content-Type": type });
            res.end(content);
        }
        catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(`${err}`);
        }
    });
    server.listen(port);
}
exports.serve = serve;
//# sourceMappingURL=serve.js.map