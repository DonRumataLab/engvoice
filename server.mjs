import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5173);
const maxUploadBytes = 25 * 1024 * 1024;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;

    request.on("data", (chunk) => {
      size += chunk.length;

      if (size > maxUploadBytes) {
        reject(new Error("Recording is too large."));
        request.destroy();
        return;
      }

      chunks.push(chunk);
    });

    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function handleTranscription(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" });
    response.end("Method not allowed");
    return;
  }

  if (!process.env.OPENAI_API_KEY) {
    sendJson(response, 500, { error: "OPENAI_API_KEY is not configured." });
    return;
  }

  try {
    const body = await readRequestBody(request);
    const openaiResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": request.headers["content-type"] || "application/octet-stream",
      },
      body,
    });

    const responseBody = await openaiResponse.text();
    response.writeHead(openaiResponse.status, {
      "Content-Type": openaiResponse.headers.get("content-type") || "application/json",
    });
    response.end(responseBody);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Transcription failed.",
    });
  }
}

async function handleStatic(request, response) {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const relativePath = safePath === "/" ? "index.html" : safePath.replace(/^[/\\]/, "");
  const absolutePath = join(rootDir, relativePath);

  if (!absolutePath.startsWith(rootDir) || !existsSync(absolutePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = extname(absolutePath);
  const contentType = mimeTypes[extension] || "application/octet-stream";

  response.writeHead(200, {
    "Cache-Control": extension === ".html" ? "no-cache" : "public, max-age=3600",
    "Content-Type": contentType,
  });
  createReadStream(absolutePath).pipe(response);
}

const server = createServer(async (request, response) => {
  if (request.url?.startsWith("/api/transcribe")) {
    await handleTranscription(request, response);
    return;
  }

  await handleStatic(request, response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`EngVoice server listening on http://0.0.0.0:${port}`);
});
