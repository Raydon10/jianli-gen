import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDir = join(root, "resume-data");
const templateDir = join(dataDir, "简历模版");
const publicMaskedPath = join(dataDir, "ai-input.md");
const aiOutputPath = join(dataDir, "ai-output.html");
const legacyAiInputPath = join(dataDir, "ai.md");
const legacyPublicMaskedPath = join(dataDir, "public.masked.md");
const privatePath = join(dataDir, "private.enc.json");
const statePath = join(dataDir, "state.json");
const port = Number(process.env.PORT || 8790);
const host = "0.0.0.0";
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

  if (request.url === "/api/public-masked" && request.method === "GET") {
    if (!(await exists(publicMaskedPath)) && !(await exists(legacyAiInputPath)) && !(await exists(legacyPublicMaskedPath))) {
      send(response, 404, "Not found");
      return true;
    }
    const path = (await exists(publicMaskedPath))
      ? publicMaskedPath
      : (await exists(legacyAiInputPath))
        ? legacyAiInputPath
        : legacyPublicMaskedPath;
    send(response, 200, await readFile(path, "utf8"), "text/plain; charset=utf-8");
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

  if (request.url === "/api/resume-templates" && request.method === "GET") {
    await mkdir(templateDir, { recursive: true });
    const files = (await readdir(templateDir))
      .filter(file => file.endsWith(".html"))
      .sort();
    const templates = files.map(file => ({
      id: file.replace(/\.html$/, ""),
      name: file.replace(/\.html$/, "").replaceAll("-", " "),
      file
    }));
    send(response, 200, JSON.stringify({ templates }), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/ai-output/meta" && request.method === "GET") {
    if (!(await exists(aiOutputPath))) {
      send(response, 200, JSON.stringify({ exists: false }), "application/json; charset=utf-8");
      return true;
    }
    const info = await stat(aiOutputPath);
    send(response, 200, JSON.stringify({
      exists: true,
      version: String(Math.floor(info.mtimeMs)),
      updatedAt: info.mtime.toISOString()
    }), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/ai-output" && request.method === "GET") {
    if (!(await exists(aiOutputPath))) {
      send(response, 404, "Not found");
      return true;
    }
    send(response, 200, await readFile(aiOutputPath, "utf8"), "text/html; charset=utf-8");
    return true;
  }

  if (request.url.startsWith("/api/resume-templates/") && request.method === "GET") {
    const id = decodeURIComponent(request.url.slice("/api/resume-templates/".length));
    if (!/^[\p{L}\p{N}_-]+$/u.test(id)) {
      send(response, 400, "Invalid template id");
      return true;
    }
    const filePath = join(templateDir, `${id}.html`);
    if (!filePath.startsWith(templateDir) || !(await exists(filePath))) {
      send(response, 404, "Not found");
      return true;
    }
    send(response, 200, await readFile(filePath, "utf8"), "text/html; charset=utf-8");
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
    const metadata = payload.metadata ?? {};
    if (payload.mode === "plain") {
      const fields = Array.isArray(payload.fields) ? payload.fields : [];
      const plainPayload = {
        mode: "plain",
        fields,
        metadata
      };
      await ensureDataDir();
      await writeFile(privatePath, `${JSON.stringify(plainPayload, null, 2)}\n`);
      const state = await updateState({
        privateSavedAt: new Date().toISOString(),
        privateEncrypted: false,
        privateMode: "plain",
        privateCipherHash: null,
        privateFieldKeys: Array.isArray(metadata.fieldKeys) ? metadata.fieldKeys : fields.map(field => field.key),
        privateFieldTypes: Array.isArray(metadata.fieldTypes) ? metadata.fieldTypes : fields.map(() => "text"),
        privateFieldCount: Number.isInteger(metadata.fieldCount) ? metadata.fieldCount : fields.length,
        privateClearedAt: new Date().toISOString()
      });
      send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
      return true;
    }

    const encrypted = payload.encrypted ?? payload;
    if (!encrypted.ciphertext || !encrypted.salt || !encrypted.iv) {
      send(response, 400, "Invalid encrypted payload");
      return true;
    }
    await ensureDataDir();
    await writeFile(privatePath, `${JSON.stringify(encrypted, null, 2)}\n`);
    const state = await updateState({
      privateSavedAt: new Date().toISOString(),
      privateEncrypted: true,
      privateMode: "encrypted",
      privateCipherHash: hash(JSON.stringify(encrypted)),
      privateFieldKeys: Array.isArray(metadata.fieldKeys) ? metadata.fieldKeys : [],
      privateFieldTypes: Array.isArray(metadata.fieldTypes) ? metadata.fieldTypes : [],
      privateFieldCount: Number.isInteger(metadata.fieldCount) ? metadata.fieldCount : 0
    });
    send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return true;
  }

  if (request.url === "/api/private" && request.method === "DELETE") {
    await ensureDataDir();
    try {
      const state = await readJson(statePath, {});
      const keys = Array.isArray(state.privateFieldKeys) && state.privateFieldKeys.length
        ? state.privateFieldKeys
        : defaultPrivateKeys;
      const types = Array.isArray(state.privateFieldTypes) && state.privateFieldTypes.length
        ? state.privateFieldTypes
        : keys.map(() => "text");
      const plainPayload = {
        mode: "plain",
        fields: keys.map((key, index) => ({
          key,
          type: types[index] || "text",
          value: ""
        })),
        metadata: {
          fieldKeys: keys,
          fieldTypes: types,
          fieldCount: keys.length
        }
      };
      await writeFile(privatePath, `${JSON.stringify(plainPayload, null, 2)}\n`);
    } catch {}
    const state = await updateState({
      privateSavedAt: new Date().toISOString(),
      privateEncrypted: false,
      privateMode: "plain",
      privateCipherHash: null,
      privateFieldKeys: defaultPrivateKeys,
      privateFieldTypes: defaultPrivateKeys.map(() => "text"),
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
  const pathname = url.pathname === "/" ? "/app/index.html" : url.pathname;
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
  console.log(`简历 Gen running at http://${host}:${port}`);
});
