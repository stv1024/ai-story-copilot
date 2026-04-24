import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const webRoot = path.join(repoRoot, "apps", "web");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function getContentType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function withinRoot(targetPath, rootPath) {
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

async function resolveFile(requestPath) {
  if (requestPath === "/" || requestPath === "/index.html") {
    return path.join(webRoot, "index.html");
  }

  const normalizedPath = decodeURIComponent(requestPath.split("?")[0]);

  if (normalizedPath.startsWith("/prompts/")) {
    const promptPath = path.join(repoRoot, normalizedPath.slice(1));
    if (withinRoot(promptPath, repoRoot)) {
      return promptPath;
    }
  }

  const webPath = path.join(webRoot, normalizedPath.slice(1));
  if (withinRoot(webPath, webRoot)) {
    return webPath;
  }

  return path.join(webRoot, "index.html");
}

export function createDevServer() {
  return createServer(async (request, response) => {
    try {
      const filePath = await resolveFile(request.url || "/");
      const fileInfo = await stat(filePath);

      if (fileInfo.isDirectory()) {
        response.writeHead(404);
        response.end("Not Found");
        return;
      }

      const fileBuffer = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": getContentType(filePath),
        "Cache-Control": "no-store",
      });
      response.end(fileBuffer);
    } catch (error) {
      response.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Not Found");
    }
  });
}

if (process.argv[1] === __filename) {
  const port = Number(process.env.PORT || 4173);
  const server = createDevServer();
  server.listen(port, () => {
    console.log(`AI Story Copilot dev server running at http://localhost:${port}`);
  });
}

