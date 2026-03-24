const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildUsageResponse, buildProvidersMetaResponse } = require("./lib/usage-core");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, "public");

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function mimeTypeFor(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}

function serveStatic(req, res) {
  const reqPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const relativePath = reqPath === "/" ? "index.html" : reqPath.replace(/^[/\\]+/, "");
  const normalized = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": mimeTypeFor(filePath),
    "Cache-Control": "no-store"
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const reqPath = (req.url || "/").split("?")[0];

  if (reqPath === "/api/usage") {
    try {
      const payload = await buildUsageResponse();
      return jsonResponse(res, 200, payload);
    } catch (error) {
      return jsonResponse(res, 500, {
        ok: false,
        generatedAt: new Date().toISOString(),
        providers: [],
        error: error.message || "Internal server error"
      });
    }
  }

  if (reqPath === "/api/providers") {
    try {
      const payload = buildProvidersMetaResponse();
      return jsonResponse(res, 200, payload);
    } catch (error) {
      return jsonResponse(res, 500, {
        ok: false,
        providers: [],
        error: error.message || "Invalid config"
      });
    }
  }

  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Token dashboard running: http://localhost:${PORT}`);
});
