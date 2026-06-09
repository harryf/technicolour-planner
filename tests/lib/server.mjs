// Minimal static file server (no dependencies). Serves a directory over http on a free port.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".css": "text/css", ".svg": "image/svg+xml", ".txt": "text/plain",
};

export function serve(rootDir) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        let p = decodeURIComponent(req.url.split("?")[0]);
        if (p.endsWith("/")) p += "index.html";
        const file = join(rootDir, normalize(p));
        if (!file.startsWith(rootDir + sep) && file !== rootDir) { res.writeHead(403); return res.end("forbidden"); }
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch { res.writeHead(404); res.end("not found"); }
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ port, url: `http://127.0.0.1:${port}`, close: () => new Promise(r => server.close(r)) });
    });
  });
}
