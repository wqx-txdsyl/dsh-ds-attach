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
import { pathToFileURL } from "node:url";

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
    disableFontFace: true,
    // pdfjs v6 moved JBIG2/JPEG2000 decoders into wasm binaries; its Node
    // build (NodeBinaryDataFactory) reads them from local paths. Without
    // wasmUrl, scanned pages whose images are JBIG2-encoded render blank.
    wasmUrl: join(profileModules(), "pdfjs-dist", "wasm") + "/",
    cMapUrl: join(profileModules(), "pdfjs-dist", "cmaps") + "/",
    standardFontDataUrl: join(profileModules(), "pdfjs-dist", "standard_fonts") + "/"
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
  // Vision OCR runs only when the PDF has NO text layer (pure scan), or when
  // explicitly forced. A PDF with any text layer (even a low-quality embedded
  // OCR layer) is extracted from that layer instantly — mirroring how
  // chat.deepseek.com parses uploaded PDFs (fast server-side text extraction),
  // so uploads don't stall for minutes. To get the sharper vision-OCR text for
  // a scanned book with a poor embedded layer, set DS_ATTACH_FORCE_OCR=1.
  if (shouldOcr(text, textless) && doc.numPages > 0) {
    try {
      const ocrText = await ocrPdfPages(pdfjs, doc, buf);
      if (ocrText.trim() !== "") text = ocrText.trim();
    } catch { /* OCR failed; keep the text layer / empty text */ }
  }
  return text;
}

/**
 * Decide whether to run the vision OCR on a PDF.
 * Default: only when the PDF has NO text layer (pure scan) — mirroring
 * chat.deepseek.com, any embedded text layer is used as-is (fast path). Note
 * some scanned books carry a low-quality embedded OCR text layer (page-number
 * junk, misread characters like 筒卡尔 for 笛卡尔); the official chat reads
 * that same layer. Set DS_ATTACH_FORCE_OCR=1 to get cleaner vision-OCR text
 * for such books (per-page recognition, slower). DS_ATTACH_TEXTLAYER_ONLY=1
 * never OCRs.
 */
function shouldOcr(text, textless) {
  if (process.env.DS_ATTACH_TEXTLAYER_ONLY === "1") return false;
  if (process.env.DS_ATTACH_FORCE_OCR === "1") return true;
  return textless || !text || text.trim() === "";
}

/** Render each PDF page to a JPEG and run OCR (OpenAI-compatible vision model).
 *  Pages are processed in parallel (cfg.concurrency) and joined in page order. */
async function ocrPdfPages(pdfjs, doc, buf) {
  const cfg = ocrConfig();
  if (!cfg.apiKey || !cfg.model) return "";
  // Lazy-load @napi-rs/canvas (prebuilt, no compile) from the profile's
  // node_modules (the plugin is installed via pnpm link).
  let createCanvas;
  try {
    const mods = profileModules();
    ({ createCanvas } = await import(pathToFileURL(join(mods, "@napi-rs", "canvas", "index.js")).href));
  } catch { return ""; }
  const pages = new Array(doc.numPages).fill("");
  let next = 0;
  async function worker() {
    while (next < doc.numPages) {
      const i = next++;
      try {
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: cfg.scale });
        const w = Math.ceil(viewport.width), h = Math.ceil(viewport.height);
        const canvas = createCanvas(w, h);
        const ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport }).promise;
        // Physically crop headers/footers/page numbers before OCR: vision
        // models skip "ignore headers" prompts unreliably, but pixels that
        // aren't in the image can't leak into the body text.
        let out = canvas;
        const cropTop = Math.round(h * cfg.cropTop);
        const cropBottom = Math.round(h * cfg.cropBottom);
        const cropH = h - cropTop - cropBottom;
        if (cropH > 0 && (cropTop > 0 || cropBottom > 0)) {
          const c2 = createCanvas(w, cropH);
          const c2x = c2.getContext("2d");
          c2x.drawImage(canvas, 0, cropTop, w, cropH, 0, 0, w, cropH);
          out = c2;
        }
        // JPEG instead of PNG: ~10x smaller payload, faster uploads, same legibility.
        const jpeg = out.toBuffer("image/jpeg", { quality: 0.85 });
        const text = await ocrImage(jpeg.toString("base64"), cfg);
        if (text.trim()) pages[i] = text.trim();
      } catch { /* skip page */ }
    }
  }
  const n = Math.max(1, Math.min(cfg.concurrency, doc.numPages));
  await Promise.all(Array.from({ length: n }, worker));
  return pages.filter(Boolean).join("\n\n");
}

/** OCR one page image via chat/completions (same protocol as dsh-plugin-book-convert). */
async function ocrImage(base64, cfg) {
  const url = `${cfg.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const body = {
    model: cfg.model,
    messages: [{
      role: "user",
      content: [
        {
          type: "text",
          text: "这是一张扫描书页的图片。请识别其中的正文文字，严格按阅读顺序输出，保留段落结构；忽略页眉、页脚、页码、书名等重复出现的装饰性文字；只输出文字本身，不要添加任何解释或前言。"
        },
        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
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
    timeoutMs: Number(env("BOOK_OCR_TIMEOUT_MS", "120000")),
    // Higher scale => sharper glyphs => fewer misread characters (2 -> 3).
    scale: Number(env("BOOK_OCR_SCALE", "3")),
    // Render/OCR a few pages in parallel to cut total time for long scans.
    concurrency: Number(env("BOOK_OCR_CONCURRENCY", "2")),
    // Crop headers/footers/page numbers before OCR (fractions of page height;
    // set to 0 to disable). More reliable than asking the model to skip them.
    cropTop: Number(env("BOOK_OCR_CROP_TOP", "0.07")),
    cropBottom: Number(env("BOOK_OCR_CROP_BOTTOM", "0.08"))
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

/** Extract text from a .pptx (zip of slide XMLs) via jszip. */
async function extractPptx(buf) {
  const jszip = loadLib("jszip");
  if (!jszip) return "";
  let zip;
  try {
    zip = await jszip.loadAsync(buf);
  } catch { return ""; }
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  const parts = [];
  const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  for (const name of slideFiles) {
    try {
      const xml = await zip.file(name).async("string");
      const texts = [];
      // `<a:t>` run text only: `(?=[ >])` requires a space or `>` right after
      // `<a:t`, so `<a:tab/>` and `<a:txBody>` (which share the `<a:t` prefix)
      // can't match and swallow everything up to the next `</a:t>`.
      const re = /<a:t(?=[ >])[^>]*>([\s\S]*?)<\/a:t>/g;
      let m;
      while ((m = re.exec(xml))) {
        const t = unesc(m[1]).trim();
        if (t) texts.push(t);
      }
      if (texts.length) parts.push(texts.join(""));
    } catch { /* skip slide */ }
  }
  return parts.join("\n\n").trim();
}

async function extractText(buf, ext) {
  const e = (ext || "").toLowerCase().replace(/^\./, "");
  if (e === "pdf") return { text: await extractPdf(buf), extracted: true };
  if (e === "docx") return { text: await extractDocx(buf), extracted: true };
  if (e === "xlsx") return { text: await extractXlsx(buf), extracted: true };
  if (e === "pptx") return { text: await extractPptx(buf), extracted: true };
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
    // Cap text length so the injected message stays inside the model's context
    // window. 150k chars covers a full ~76k-char book; raise with
    // DS_ATTACH_MAX_CHARS if you feed it longer documents. Cut happens at a
    // page/paragraph boundary, never mid-sentence.
    const MAX_CHARS = Number(process.env.DS_ATTACH_MAX_CHARS || "150000");
    let capped = text;
    let truncated = text.length > MAX_CHARS;
    if (truncated) {
      let cut = text.slice(0, MAX_CHARS);
      const nl = cut.lastIndexOf("\n\n");
      if (nl > MAX_CHARS * 0.8) cut = cut.slice(0, nl);
      capped = cut + "\n\n…[已截断：文件过大，仅注入前文。可用环境变量 DS_ATTACH_MAX_CHARS 调大上限]";
    }
    sendJson(res, 200, { ok: true, path: target, size: st.size, name, ext: ext.replace(/^\./, ""), text: capped, extracted, truncated });
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
