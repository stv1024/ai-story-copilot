import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const promptsRoot = path.join(repoRoot, "prompts");
const promptFiles = ["system-role.txt", "story-beat-request.txt", "window-summary.txt"];

function promptMiddleware() {
  return async (request, response, next) => {
    const requestUrl = new URL(request.url || "/", "http://localhost");

    if (!requestUrl.pathname.startsWith("/prompts/")) {
      next();
      return;
    }

    const fileName = path.basename(requestUrl.pathname);
    if (!promptFiles.includes(fileName)) {
      response.statusCode = 404;
      response.end("Not Found");
      return;
    }

    try {
      const content = await readFile(path.join(promptsRoot, fileName), "utf8");
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.end(content);
    } catch (error) {
      response.statusCode = 404;
      response.end("Not Found");
    }
  };
}

function promptAssetsPlugin() {
  return {
    name: "story-prompt-assets",
    configureServer(server) {
      server.middlewares.use(promptMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(promptMiddleware());
    },
    async closeBundle() {
      const outputRoot = path.join(__dirname, "dist", "prompts");
      await mkdir(outputRoot, { recursive: true });
      await Promise.all(
        promptFiles.map((fileName) => copyFile(path.join(promptsRoot, fileName), path.join(outputRoot, fileName))),
      );
    },
  };
}

export default defineConfig({
  plugins: [vue(), promptAssetsPlugin()],
  server: {
    port: 5183,
  },
  preview: {
    allowedHosts: ["healthcheck.railway.app", ".up.railway.app"],
  },
});
