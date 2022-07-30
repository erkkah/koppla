import { stat, watch } from "fs/promises";
import { createServer } from "http";

export function serve(
    sourceFile: string,
    port: number,
    generator: (
        sourceFile: string
    ) => Promise<{ content: string; type: string }>
) {
    let updated = Date.now();

    (async () => {
        const watcher = watch(sourceFile, { recursive: false });
        for await (const _ of watcher) {
            const stats = await stat(sourceFile);
            updated = stats.mtime.getTime();
        }
    })();

    const server = createServer(async (req, res) => {
        const url = new URL(req.url ?? "", `http://${req.headers.host}`);

        if (url.searchParams.has("lastUpdated")) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
                JSON.stringify({
                    updated,
                })
            );
            return;
        }

        try {
            const { content, type } = await generator(sourceFile);

            res.writeHead(200, { "Content-Type": type });
            res.end(content);
        } catch (err) {
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end(`${err}`);
        }
    });

    server.listen(port);
}
