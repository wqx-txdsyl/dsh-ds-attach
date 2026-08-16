/**
 * dsh-ds-attach host half.
 *
 * Mirrors chat.deepseek.com attachment pipeline:
 *   upload -> store file -> extract text (PDF/DOCX/XLSX/TXT) -> return both
 *
 * Routes:
 *   POST /ds-attach/upload   { sessionId, name, data(base64) }
 *       stores under <DSH_HOME>/ds-attach/<sessionId>/<name>, extracts text,
 *       returns { ok, path, size, text, ext, extracted }
 *   GET  /ds-attach/file?p=<path>  read stored file (preview/download)
 *   GET  /ds-attach/meta?p=<path>  return { name, size, ext }
 */
import { readFile, mkdir, writeFile, stat, unlink, readdir } from "node:fs/promises";
import { join, resolve, basename, extname } from "node:path";
import { homedir } from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The plugin is installed via pnpm link: its own node_modules may be absent.
// Resolve parse libs from the profile's node_modules first (that's where the
// harness installs everything), then fall back to the plugin's own location.
function profileModules() {
  const anchor = process.env.DSH_PROFILE_DIR
    || (process.env.DSH_HOME ? join(process.env.DSH_HOME, "profiles", "web") : join(homedir(), ".dsh", "profiles", "web"));
  return join(anchor, "node_modules");
}
const profileRequire = createRequire(join(profileModules(), "noop.js"));
function loadLib(name) {
  try { return require(name); } catch { /* plugin-local missing */ }
  try { return profileRequire(name); } catch { /* profile missing */ }
  return null;
}
const ROUTE_UPLOAD = "/ds-attach/upload";
const ROUTE_FILE = "/ds-attach/file";
const ROUTE_META = "/ds-attach/meta";

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), ".dsh");
}
function uploadRoot() {
  return join(dshHome(), "ds-attach");
}
function safeSegment(s) {
  const v = String(s || "default").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64);
  return v || "default";
}
function safeName(name) {
  const base = basename(String(name || "file"))
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .slice(0, 180);
  return base || "file";
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", (c) => {
      total += c.length;
      if (total > limit) { reject(new Error("payload too large")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(obj));
}

// ---- text extraction ----
const TEXT_EXTS = new Set(["txt", "md", "log", "json", "yml", "yaml", "xml", "html", "css", "js", "ts", "py", "java", "c", "cpp", "go", "rs", "sh", "csv"]);

function extractTextFile(buf) {
  // Try UTF-8; fall back to latin1 to avoid throwing on binary.
  try {
    const s = buf.toString("utf8");
    if (s.includes("\uFFFD")) return buf.toString("latin1");
    return s;
  } catch { return buf.toString("latin1"); }
}

async function extractPdf(buf) {
  const pdfjs = await loadPdfJs();
  if (!pdfjs) return "";
  if (typeof globalThis.DOMMatrix === "undefined") {
    globalThis.DOMMatrix = class { constructor() {} static fromMatrix() { return new this(); } };
  }
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buf),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true
  }).promise;
  let text = "";
  let textless = true;
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it) => it.str || "").join(" ") + "\n";
      text += pageText;
      if (pageText.trim() !== "") textless = false;
    } catch { /* skip page */ }
  }
  text = text.trim();
  // Scanned PDF (no text layer): render pages to images and OCR them via the
  // configured vision model (mirrors DeepSeek Chat's OCR support).
  if (textless && text === "" && doc.numPages > 0) {
    try {
      const ocrText = await ocrPdfPages(pdfjs, doc, buf);
      if (ocrText.trim() !== "") text = ocrText.trim();
    } catch { /* OCR failed; leave empty so UI shows "no text extracted" */ }
  }
  return text;
}

/** Render each PDF page to a PNG and run OCR (OpenAI-compatible vision model). */
async function ocrPdfPages(pdfjs, doc, buf) {
  const cfg = ocrConfig();
  if (!cfg.apiKey || !cfg.model) return "";
  // Lazy-load @napi-rs/canvas (prebuilt, no compile) from the profile's
  // node_modules (the plugin is installed via pnpm link).
  let createCanvas;
  try {
    const mods = profileModules();
    ({ createCanvas } = await import(join(mods, "@napi-rs", "canvas", "index.js")));
  } catch { return ""; }
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    try {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const png = canvas.toBuffer("image/png");
      const text = await ocrImage(png.toString("base64"), cfg);
      if (text.trim()) out.push(text.trim());
    } catch { /* skip page */ }
  }
  return out.join("\n\n");
}

/** OCR one page image via chat/completions (same protocol as dsh-plugin-book-convert). */
async function ocrImage(base64, cfg) {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: cfg.model,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "请识别这张图片中的所有文字，按阅读顺序输出，保留段落结构，不要添加任何解释。" },
        { type: "image_url", image_url: { url: `data:image/png;base64,${base64}` } }
      ]
    }],
    max_tokens: cfg.maxTokens,
    temperature: 0
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(cfg.timeoutMs)
  });
  if (!resp.ok) throw new Error(`OCR API ${resp.status}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content ?? "";
  if (Array.isArray(content)) return content.map((b) => b.text ?? "").filter(Boolean).join("\n");
  return String(content ?? "");
}

/** OCR backend config: BOOK_OCR_* env vars (shared with dsh-plugin-book-convert),
 *  falling back to DEEPEYE_API_KEY (Zhipu vision key used by dsh-plugin-deepeye). */
function ocrConfig() {
  const env = (n, d) => { const v = process.env[n]; return v === undefined || v === "" ? d : v; };
  const apiKey = env("BOOK_OCR_API_KEY", "") || env("DEEPEYE_API_KEY", "");
  return {
    apiKey,
    baseUrl: env("BOOK_OCR_BASE_URL", "https://open.bigmodel.cn/api/paas/v4"),
    model: env("BOOK_OCR_MODEL", "glm-4v-flash"),
    maxTokens: Number(env("BOOK_OCR_MAX_TOKENS", "1024")),
    timeoutMs: Number(env("BOOK_OCR_TIMEOUT_MS", "120000"))
  };
}

async function loadPdfJs() {
  const { pathToFileURL } = await import("node:url");
  const candidates = [
    join(profileModules(), "pdfjs-dist", "legacy", "build", "pdf.mjs"),
    join(profileModules(), "pdfjs-dist", "build", "pdf.mjs"),
    join(import.meta.dirname || ".", "..", "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs")
  ];
  for (const c of candidates) {
    try { return await import(pathToFileURL(c).href); } catch { /* next */ }
  }
  return null;
}

async function extractDocx(buf) {
  const mammoth = loadLib("mammoth");
  if (!mammoth) return "";
  const tmp = join(dshHome(), "ds-attach", "tmp", `docx-${Date.now()}-${Math.random().toString(36).slice(2)}.docx`);
  await mkdir(join(dshHome(), "ds-attach", "tmp"), { recursive: true });
  await writeFile(tmp, buf);
  try {
    const r = await mammoth.extractRawText({ path: tmp });
    return (r.value || "").trim();
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function extractXlsx(buf) {
  const xlsx = loadLib("xlsx");
  if (!xlsx) return "";
  const tmp = join(dshHome(), "ds-attach", "tmp", `xlsx-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
  await mkdir(join(dshHome(), "ds-attach", "tmp"), { recursive: true });
  await writeFile(tmp, buf);
  try {
    const wb = xlsx.readFile(tmp, { cellText: true });
    const parts = [];
    for (const name of wb.SheetNames.slice(0, 5)) {
      const rows = xlsx.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false });
      parts.push(`【工作表: ${name}】`);
      for (const row of rows.slice(0, 200)) {
        if (Array.isArray(row)) parts.push(row.map((c) => String(c ?? "")).join("\t"));
      }
    }
    return parts.join("\n").trim();
  } finally {
    await unlink(tmp).catch(() => {});
  }
}

async function extractText(buf, ext) {
  const e = (ext || "").toLowerCase().replace(/^\./, "");
  if (e === "pdf") return { text: await extractPdf(buf), extracted: true };
  if (e === "docx") return { text: await extractDocx(buf), extracted: true };
  if (e === "xlsx") return { text: await extractXlsx(buf), extracted: true };
  if (e === "doc") return { text: "[.doc 旧版格式：请转换为 .docx 后上传]", extracted: false };
  if (TEXT_EXTS.has(e)) return { text: extractTextFile(buf), extracted: true };
  return { text: "", extracted: false }; // binary/unknown: no extraction
}

// ---- routes ----
async function handleUpload(req, res) {
  try {
    const raw = await readBody(req, 64 * 1024 * 1024);
    let body;
    try { body = JSON.parse(raw.toString("utf8")); } catch { body = null; }
    if (!body || typeof body.name !== "string" || typeof body.data !== "string") {
      sendJson(res, 400, { ok: false, error: "expected { name, data(base64), sessionId }" });
      return;
    }
    const sessionId = safeSegment(body.sessionId);
    const name = safeName(body.name);
    const buf = Buffer.from(body.data, "base64");
    if (buf.length === 0) { sendJson(res, 400, { ok: false, error: "empty file" }); return; }
    const dir = join(uploadRoot(), sessionId);
    await mkdir(dir, { recursive: true });
    const target = resolve(join(dir, name));
    if (!target.startsWith(resolve(dir))) { sendJson(res, 400, { ok: false, error: "bad path" }); return; }
    await writeFile(target, buf);
    const st = await stat(target);
    const ext = extname(name);
    const { text, extracted } = await extractText(buf, ext);
    // Cap text length (mirror DeepSeek token-budget truncation)
    const MAX_CHARS = 60000;
    const capped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + "\n…[已截断，DeepSeek 只能读取部分文件内容]" : text;
    sendJson(res, 200, { ok: true, path: target, size: st.size, name, ext: ext.replace(/^\./, ""), text: capped, extracted, truncated: text.length > MAX_CHARS });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String((e && e.message) || e) });
  }
}

async function handleFile(req, res) {
  try {
    const url = new URL(req.url || "/", "http://x");
    const p = url.searchParams.get("p");
    if (!p) { sendJson(res, 400, { ok: false, error: "missing p" }); return; }
    const root = resolve(uploadRoot());
    const target = resolve(p);
    if (!target.startsWith(root)) { sendJson(res, 403, { ok: false, error: "forbidden" }); return; }
    const data = await readFile(target);
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": data.length });
    res.end(data);
  } catch {
    sendJson(res, 404, { ok: false, error: "not found" });
  }
}

async function handleMeta(req, res) {
  try {
    const url = new URL(req.url || "/", "http://x");
    const p = url.searchParams.get("p");
    if (!p) { sendJson(res, 400, { ok: false, error: "missing p" }); return; }
    const root = resolve(uploadRoot());
    const target = resolve(p);
    if (!target.startsWith(root)) { sendJson(res, 403, { ok: false, error: "forbidden" }); return; }
    const st = await stat(target);
    sendJson(res, 200, { ok: true, name: basename(target), size: st.size, ext: extname(target).replace(/^\./, "") });
  } catch {
    sendJson(res, 404, { ok: false, error: "not found" });
  }
}

// ---- plugin entry ----
const name = "dsh-ds-attach";
const inject = ["webServer"];

function apply(ctx) {
  const server = ctx.get("webServer");
  if (!server) return;
  ctx.effect(() => {
    const offs = [
      server.register({ kind: "exact", path: ROUTE_UPLOAD, handler: handleUpload }),
      server.register({ kind: "exact", path: ROUTE_FILE, handler: handleFile }),
      server.register({ kind: "exact", path: ROUTE_META, handler: handleMeta })
    ];
    return () => { for (const off of offs) off(); };
  }, "dsh-ds-attach: routes");
}

export { apply, inject, name };
