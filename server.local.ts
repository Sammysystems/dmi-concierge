import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";
import chatHandler from "./api/chat.ts";
import publicHandler from "./api/public/[slug].ts";
import publicIndexHandler from "./api/public/index.ts";

const PORT = Number(process.env.PORT ?? 3000);
const DIST = join(process.cwd(), "dist");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function shimRes(nodeRes: ServerResponse) {
  const res = {
    statusCode: 200,
    headersSent: false,
    _headers: {} as Record<string, string>,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    setHeader(k: string, v: string) {
      this._headers[k] = v;
      nodeRes.setHeader(k, v);
      return this;
    },
    json(obj: unknown) {
      if (!nodeRes.hasHeader("Content-Type")) nodeRes.setHeader("Content-Type", "application/json; charset=utf-8");
      this.headersSent = true;
      nodeRes.statusCode = this.statusCode;
      nodeRes.end(JSON.stringify(obj));
      return this;
    },
    write(chunk: string) {
      if (!this.headersSent) {
        nodeRes.statusCode = this.statusCode;
        this.headersSent = true;
      }
      nodeRes.write(chunk);
      return true;
    },
    end(chunk?: string) {
      if (!this.headersSent) {
        nodeRes.statusCode = this.statusCode;
        this.headersSent = true;
      }
      nodeRes.end(chunk);
      return this;
    },
  };
  return res as unknown as Parameters<typeof chatHandler>[1];
}

async function serveStatic(pathname: string, nodeRes: ServerResponse) {
  const rel = decodeURIComponent(pathname.replace(/^\/+/, "")) || "index.html";
  let filePath = join(DIST, rel);
  try {
    const s = await stat(filePath);
    if (s.isDirectory()) filePath = join(filePath, "index.html");
  } catch {
    filePath = join(DIST, "index.html");
  }
  try {
    const buf = await readFile(filePath);
    nodeRes.setHeader("Content-Type", MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream");
    nodeRes.statusCode = 200;
    nodeRes.end(buf);
  } catch {
    nodeRes.statusCode = 404;
    nodeRes.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const path = url.pathname;

  const pubMatch = path.match(/^\/api\/public\/([a-z0-9-_]+)$/i);
  const apiRoutes: Record<string, (req: never, res: never) => unknown> = {
    "/api/chat": chatHandler,
    "/api/public": publicIndexHandler,
  };
  const handler = pubMatch ? publicHandler : apiRoutes[path];
  if (path.startsWith("/api/")) {
    (req as unknown as { body: unknown }).body = await readBody(req);
    const query = Object.fromEntries(url.searchParams);
    if (pubMatch) query.slug = pubMatch[1];
    (req as unknown as { query: Record<string, string> }).query = query;
    if (!handler) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "unknown endpoint" }));
      return;
    }
    try {
      await handler(req as never, shimRes(res));
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: String(err) }));
      } else {
        res.end();
      }
    }
    return;
  }

  await serveStatic(path, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Concierge desk running on http://localhost:${PORT}`);
});
