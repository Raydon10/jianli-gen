import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const dataDir = join(root, "data");
const publicPath = join(dataDir, "public.md");
const publicMaskedPath = join(dataDir, "public.masked.md");
const privatePath = join(dataDir, "private.enc.json");
const statePath = join(dataDir, "state.json");
const port = Number(process.env.PORT || 8790);
const host = "127.0.0.1";
const defaultPrivateKeys = ["姓名", "年龄", "手机", "邮箱", "城市", "公司"];

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

async function ensureDataDir() {
  await mkdir(dataDir, { recursive: true });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJson(path, fallback = {}) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function updateState(patch) {
  await ensureDataDir();
  const state = await readJson(statePath);
  const nextState = {
    ...state,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeFile(statePath, `${JSON.stringify(nextState, null, 2)}\n`);
  return nextState;
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function handleApi(request, response) {
  if (request.url === "/api/state" && request.method === "GET") {
    const state = await readJson(statePath, {});
    send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/public" && request.method === "GET") {
    if (!(await exists(publicPath))) {
      send(response, 404, "Not found");
      return true;
    }
    send(response, 200, await readFile(publicPath, "utf8"), "text/plain; charset=utf-8");
    return true;
  }

  if (request.url === "/api/public" && request.method === "PUT") {
    const body = await readBody(request);
    await ensureDataDir();
    await writeFile(publicPath, body);
    const state = await updateState({
      publicSavedAt: new Date().toISOString(),
      publicHash: hash(body)
    });
    send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/public-masked" && request.method === "GET") {
    if (!(await exists(publicMaskedPath))) {
      send(response, 404, "Not found");
      return true;
    }
    send(response, 200, await readFile(publicMaskedPath, "utf8"), "text/plain; charset=utf-8");
    return true;
  }

  if (request.url === "/api/public-masked" && request.method === "PUT") {
    const body = await readBody(request);
    await ensureDataDir();
    await writeFile(publicMaskedPath, body);
    const state = await updateState({
      publicMaskedSavedAt: new Date().toISOString(),
      publicMaskedHash: hash(body)
    });
    send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/private" && request.method === "GET") {
    if (!(await exists(privatePath))) {
      send(response, 404, "Not found");
      return true;
    }
    send(response, 200, await readFile(privatePath, "utf8"), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/private" && request.method === "PUT") {
    const body = await readBody(request);
    const payload = JSON.parse(body);
    const encrypted = payload.encrypted ?? payload;
    const metadata = payload.metadata ?? {};
    if (!encrypted.ciphertext || !encrypted.salt || !encrypted.iv) {
      send(response, 400, "Invalid encrypted payload");
      return true;
    }
    await ensureDataDir();
    await writeFile(privatePath, `${JSON.stringify(encrypted, null, 2)}\n`);
    const state = await updateState({
      privateSavedAt: new Date().toISOString(),
      privateEncrypted: true,
      privateCipherHash: hash(JSON.stringify(encrypted)),
      privateFieldKeys: Array.isArray(metadata.fieldKeys) ? metadata.fieldKeys : [],
      privateFieldCount: Number.isInteger(metadata.fieldCount) ? metadata.fieldCount : 0
    });
    send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/private" && request.method === "DELETE") {
    await ensureDataDir();
    try {
      await unlink(privatePath);
    } catch {}
    const state = await updateState({
      privateSavedAt: null,
      privateEncrypted: false,
      privateCipherHash: null,
      privateFieldKeys: defaultPrivateKeys,
      privateFieldCount: defaultPrivateKeys.length,
      privateClearedAt: new Date().toISOString()
    });
    send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return true;
  }

  return false;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${host}:${port}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalized = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(root, normalized);

  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const content = await readFile(filePath);
    send(response, 200, content, mimeTypes[extname(filePath)] || "application/octet-stream");
  } catch {
    send(response, 404, "Not found");
  }
}

createServer(async (request, response) => {
  try {
    if (await handleApi(request, response)) {
      return;
    }
    await serveStatic(request, response);
  } catch (error) {
    send(response, 500, error instanceof Error ? error.message : "Server error");
  }
}).listen(port, host, () => {
  console.log(`Jianli Shield Gen running at http://${host}:${port}`);
});
