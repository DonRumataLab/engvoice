import { createReadStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
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

function parseMultipart(buffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return {};

  const boundary = `--${boundaryMatch[1] || boundaryMatch[2]}`;
  const body = buffer.toString("binary");
  const parts = body.split(boundary).slice(1, -1);
  const result = {};

  for (const part of parts) {
    const trimmed = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = trimmed.indexOf("\r\n\r\n");
    if (separatorIndex < 0) continue;

    const rawHeaders = trimmed.slice(0, separatorIndex);
    const rawBody = trimmed.slice(separatorIndex + 4);
    const nameMatch = rawHeaders.match(/name="([^"]+)"/);
    const fileNameMatch = rawHeaders.match(/filename="([^"]*)"/);
    const contentTypeMatch = rawHeaders.match(/Content-Type:\s*([^\r\n]+)/i);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const content = Buffer.from(rawBody, "binary");

    if (fileNameMatch) {
      result[name] = {
        buffer: content,
        contentType: contentTypeMatch?.[1] || "application/octet-stream",
        filename: fileNameMatch[1],
      };
    } else {
      result[name] = content.toString("utf8");
    }
  }

  return result;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      shell: false,
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
      }
    });
  });
}

async function findFileByExtension(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await findFileByExtension(entryPath, extension);
      if (nested) return nested;
    } else if (entry.name.toLowerCase().endsWith(extension)) {
      return entryPath;
    }
  }

  return null;
}

function parseTextGridTier(textGrid, tierName) {
  const tierStart = textGrid.indexOf(`name = "${tierName}"`);
  if (tierStart < 0) return [];

  const nextTierStart = textGrid.indexOf("\n    item [", tierStart + 1);
  const tierText = textGrid.slice(tierStart, nextTierStart > -1 ? nextTierStart : undefined);
  const intervals = [];
  const intervalPattern =
    /intervals \[\d+\]:\s*xmin = ([\d.]+)\s*xmax = ([\d.]+)\s*text = "(.*?)"/gs;
  let match = intervalPattern.exec(tierText);

  while (match) {
    const label = match[3].trim();
    if (label) {
      intervals.push({
        start: Number(match[1]),
        end: Number(match[2]),
        label,
      });
    }
    match = intervalPattern.exec(tierText);
  }

  return intervals;
}

function parseAlignmentTextGrid(textGrid) {
  const words = parseTextGridTier(textGrid, "words");
  const phones = parseTextGridTier(textGrid, "phones");

  return words.map((word) => ({
    ...word,
    phonemes: phones.filter((phone) => {
      const midpoint = (phone.start + phone.end) / 2;
      return midpoint >= word.start && midpoint <= word.end;
    }),
  }));
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

async function handlePhonemeAlignment(request, response) {
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST" });
    response.end("Method not allowed");
    return;
  }

  const mfaBin = process.env.MFA_BIN || "mfa";
  const ffmpegBin = process.env.FFMPEG_BIN || "ffmpeg";
  const dictionary = process.env.MFA_DICTIONARY || "english_us_arpa";
  const acousticModel = process.env.MFA_ACOUSTIC_MODEL || "english_us_arpa";
  const mfaNumJobs = process.env.MFA_NUM_JOBS || "1";
  let workDir = null;

  try {
    const body = await readRequestBody(request);
    const form = parseMultipart(body, request.headers["content-type"] || "");
    const file = form.file;
    const referenceText = String(form.referenceText || "").trim();

    if (!file?.buffer || !referenceText) {
      sendJson(response, 400, { error: "Audio file and referenceText are required." });
      return;
    }

    workDir = await mkdtemp(join(tmpdir(), "engvoice-mfa-"));
    const corpusDir = join(workDir, "corpus");
    const outputDir = join(workDir, "aligned");
    await writeFile(join(workDir, "recording.webm"), file.buffer);
    await writeFile(join(workDir, "recording.txt"), referenceText);
    await mkdir(corpusDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const wavPath = join(corpusDir, "recording.wav");
    await runCommand(ffmpegBin, [
      "-y",
      "-i",
      join(workDir, "recording.webm"),
      "-ac",
      "1",
      "-ar",
      "16000",
      wavPath,
    ]);
    await writeFile(join(corpusDir, "recording.lab"), referenceText);

    await runCommand(mfaBin, [
      "align",
      corpusDir,
      dictionary,
      acousticModel,
      outputDir,
      "--clean",
      "--overwrite",
      "--single_speaker",
      "--num_jobs",
      mfaNumJobs,
    ]);

    const textGridPath = await findFileByExtension(outputDir, ".textgrid");
    if (!textGridPath) {
      sendJson(response, 500, { error: "MFA did not produce a TextGrid file." });
      return;
    }

    const textGrid = await readFile(textGridPath, "utf8");
    const words = parseAlignmentTextGrid(textGrid);
    sendJson(response, 200, {
      engine: "montreal-forced-aligner",
      words,
    });
  } catch (error) {
    sendJson(response, 501, {
      error:
        "Self-hosted phoneme alignment is not available. Install ffmpeg, Montreal Forced Aligner, dictionary, and acoustic model on the server.",
      detail: error instanceof Error ? error.message : "Unknown MFA error.",
    });
  } finally {
    if (workDir) {
      await rm(workDir, { recursive: true, force: true });
    }
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

  if (request.url?.startsWith("/api/phoneme-align")) {
    await handlePhonemeAlignment(request, response);
    return;
  }

  await handleStatic(request, response);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`EngVoice server listening on http://0.0.0.0:${port}`);
});
