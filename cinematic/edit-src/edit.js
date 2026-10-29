/* Vyana Soul: edit mode. The page opened with ?edit by one of the site's admins.
   main.js loads this file (bundled to edit.js) only for that address, so visitors never download it.
   Every change is saved to Supabase as the signed-in admin; row-level security decides what
   is allowed, not this file. Saved changes reach visitors when the admin presses Publish
   (the build bakes them into the HTML).

   1. setup   2. the page's text: original, saved, published   3. what's under the pointer
   4. editing text in place   5. photos   6. reviews   7. all text   8. the dock: changes, publish
   9. start: sign-in check, load, wire up */
import { createClient } from "@supabase/supabase-js";

/* ---------------- 1. setup ---------------- */
const SUPABASE_URL = "https://xvdoutqezjsuogankqna.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_H2PXLN9Ms30bXwxnyDz8RA_P-xIVIDO";
const FN = `${SUPABASE_URL}/functions/v1/booking`;
const BUCKET = "site-photos";
const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: true, detectSessionInUrl: false } });

const ROOT = document.querySelector('meta[name="vs-root"]')?.content || "";
const LANG = document.documentElement.lang === "hi" ? "hi" : "en";
const OTHER = LANG === "en" ? "hi" : "en";
const PAGE = /privacy\.html$/.test(location.pathname) ? "privacy.html" : "index.html";
const html = document.documentElement;
const touch = matchMedia("(hover: none)").matches;
const narrow = () => innerWidth < 720;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const norm = (v) => (v || "").replace(/\s+/g, " ").trim();
// never edited in place: code, other languages, reviews (they have their own editor), the editor itself
const SKIP = "script, style, noscript, template, svg, [translate=no], .vs-ui";
const ATTRS = ["alt", "aria-label", "placeholder", "title", "data-building", "data-ready"];
const LANG_NAME = { en: "English", hi: "Hindi" };

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  return el;
}
const ICONS = {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
  browse: '<path d="M5 3.5 18.5 12 12 13.5 9 19.5 5 3.5Z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5.5-5.5 4 4L16 14l4 4"/>',
  quote: '<path d="M10 7H6.5A1.5 1.5 0 0 0 5 8.5V12h4v5H5M19 7h-3.5A1.5 1.5 0 0 0 14 8.5V12h4v5h-4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>',
};
const icon = (name) => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("class", "vs-ic"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = ICONS[name];
  return s;
};
const quoteOf = (s, n = 90) => `“${s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s}”`;

const ui = h("div", { class: "vs-ui" });
const toastEl = h("div", { class: "vs-toast", role: "status", "aria-live": "polite" });
let toastT;
function toast(msg, kind = "") {
  toastEl.textContent = msg;
  toastEl.className = `vs-toast show ${kind}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => toastEl.classList.remove("show"), kind === "error" ? 9000 : 4200);
}

/* ---------------- 2. the page's text ----------------
   texts.json (written by the build) lists every editable text: the original (k / en / hi), and
   what this build shows (be / bh). site_text holds what the admins saved. A null keeps the original. */
let texts = [], pageTexts = [], photos = [], builtAt = null;
let saved = new Map();   // key -> { key, en, hi }
let index = new Map();   // text as shown now on this page -> [texts]
let reviews = new Map(); // id -> reviews row

const isJs = (t) => t.k.startsWith("js:");
const sameOnBoth = (t) => !t.x; // prices and numbers: one value for both pages
const original = (t, lang = LANG) => (lang === "en" || !t.x ? t.en : t.hi ?? t.en);
function current(t, lang = LANG) {
  if (lang === "hi" && sameOnBoth(t)) return current(t, "en");
  return saved.get(t.k)?.[lang] ?? original(t, lang);
}
const published = (t, lang = LANG) => (lang === "en" ? t.be : t.bh ?? t.be);
const changed = (t, lang = LANG) => current(t, lang) !== published(t, lang);

function rebuildIndex() {
  index = new Map();
  for (const t of pageTexts) {
    const v = current(t);
    if (!index.has(v)) index.set(v, []);
    index.get(v).push(t);
  }
}
const textsShowing = (v) => index.get(v) || null;

function eachText(fn) {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.nodeValue.trim() || !n.parentElement || n.parentElement.closest(SKIP)) continue;
    fn(n);
  }
}
const parts = (v) => v.match(/^(\s*)([\s\S]*?)(\s*)$/);
/** Show `to` wherever the page shows `from` (text, user-facing attributes, the tab title). */
function swapText(from, to) {
  if (from === to) return;
  eachText((n) => {
    if (norm(n.nodeValue) !== from) return;
    const [, lead, , trail] = parts(n.nodeValue);
    n.nodeValue = lead + to + trail;
  });
  for (const a of ATTRS) {
    for (const el of $$(`[${a}]`)) if (!el.closest(".vs-ui") && norm(el.getAttribute(a)) === from) el.setAttribute(a, to);
  }
  if (norm(document.title) === from) document.title = to;
}

// changes that aren't live yet get a soft gold wash (CSS Custom Highlight API, where the browser has it)
function markChanges() {
  if (!window.Highlight || !CSS.highlights) return;
  const shown = new Set(pageTexts.filter((t) => changed(t)).map((t) => current(t)));
  const mark = new Highlight();
  if (shown.size) eachText((n) => {
    if (!shown.has(norm(n.nodeValue))) return;
    const r = new Range();
    r.selectNodeContents(n);
    mark.add(r);
  });
  CSS.highlights.set("vs-changed", mark);
}

let saving = 0;
/** Save `value` for every text in `ts`, in `lang` (prices and numbers go to the English value). */
async function setText(ts, value, lang = LANG) {
  value = norm(value);
  if (!value) { toast("Text can't be empty. Write something, or press Use original.", "error"); return false; }
  const shownBefore = lang === LANG ? current(ts[0]) : null;
  const before = new Map(ts.map((t) => [t.k, saved.get(t.k)]));
  const rows = [], removals = [];
  for (const t of ts) {
    const c = lang === "hi" && sameOnBoth(t) ? "en" : lang;
    const prev = saved.get(t.k);
    const next = { key: t.k, en: prev?.en ?? null, hi: prev?.hi ?? null };
    next[c] = value === original(t, c) ? null : value;
    if (next.en == null && next.hi == null) { if (prev) removals.push(t.k); saved.delete(t.k); }
    else { rows.push(next); saved.set(t.k, next); }
  }
  const shownAfter = current(ts[0]);
  if (shownBefore != null) swapText(shownBefore, shownAfter);
  rebuildIndex(); markChanges();
  saving++; updateDock();
  const results = await Promise.all([
    rows.length ? sb.from("site_text").upsert(rows, { onConflict: "key" }) : { error: null },
    removals.length ? sb.from("site_text").delete().in("key", removals) : { error: null },
  ]);
  saving--;
  const error = results.find((r) => r.error)?.error;
  if (error) {
    // put the page back the way the database has it
    for (const [k, v] of before) { if (v) saved.set(k, v); else saved.delete(k); }
    if (shownBefore != null) swapText(shownAfter, shownBefore);
    rebuildIndex(); markChanges(); updateDock();
    toast(`Not saved: ${error.message}`, "error");
    return false;
  }
  updateDock();
  return true;
}

/* ---------------- 3. what's under the pointer ---------------- */
function visible(el) {
  for (let e = el; e && e !== document.body; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) < 0.2) return false;
  }
  return true;
}
function caretNode(x, y) {
  let n = null;
  if (document.caretPositionFromPoint) n = document.caretPositionFromPoint(x, y)?.offsetNode;
  else if (document.caretRangeFromPoint) n = document.caretRangeFromPoint(x, y)?.startContainer;
  return n?.nodeType === 3 ? n : null;
}
function rectsOf(node) {
  const r = document.createRange();
  r.selectNodeContents(node);
  return [...r.getClientRects()].filter((b) => b.width && b.height);
}
const within = (rects, x, y, pad = 6) => rects.some((b) => x >= b.left - pad && x <= b.right + pad && y >= b.top - pad && y <= b.bottom + pad);
const unroot = (src) => (ROOT && src.startsWith(ROOT) ? src.slice(ROOT.length) : src);
const photoKey = (img) => {
  const k = img.dataset.vsImg || unroot(img.getAttribute("src") || "");
  return photos.some((p) => p.k === k) ? k : null;
};

function targetAt(x, y) {
  const stack = document.elementsFromPoint(x, y);
  const top = stack[0];
  if (!top || top.closest(".vs-ui")) return null;
  const card = top.closest("[data-review]");
  if (card) return { type: "review", el: card };
  if (/^(INPUT|TEXTAREA)$/.test(top.tagName) && top.placeholder) {
    const ts = textsShowing(norm(top.placeholder));
    if (ts) return { type: "hint", el: top, ts };
  }
  const node = caretNode(x, y);
  if (node && !node.parentElement.closest(SKIP)) {
    const ts = textsShowing(norm(node.nodeValue));
    if (ts && within(rectsOf(node), x, y) && visible(node.parentElement)) return { type: "text", node, ts };
  }
  const img = stack.find((e) => e.tagName === "IMG" && photoKey(e));
  if (img && visible(img)) return { type: "photo", el: img, key: photoKey(img) };
  return null;
}

const hl = h("div", { class: "vs-hl", hidden: true }, h("span", { class: "vs-hl-tag" }));
function boxOf(t) {
  if (t.type !== "text") return t.el.getBoundingClientRect();
  const rs = rectsOf(t.node);
  const l = Math.min(...rs.map((r) => r.left)), tp = Math.min(...rs.map((r) => r.top));
  return { left: l, top: tp, width: Math.max(...rs.map((r) => r.right)) - l, height: Math.max(...rs.map((r) => r.bottom)) - tp };
}
function labelOf(t) {
  if (t.type === "photo") return "Photo";
  if (t.type === "review") return "Review";
  if (t.type === "hint") return "Hint inside the field";
  return t.ts[0].t.replace(/ \(read aloud only\)$/, "");
}
let hovered = null;
function showHL(t) {
  hovered = t;
  html.classList.toggle("vs-pointing", !!t);
  if (!t) { hl.hidden = true; return; }
  const b = boxOf(t), pad = t.type === "text" ? 4 : 0;
  Object.assign(hl.style, { left: `${b.left - pad}px`, top: `${b.top - pad}px`, width: `${b.width + pad * 2}px`, height: `${b.height + pad * 2}px` });
  hl.classList.toggle("vs-hl-low", b.top < 34);
  const tag = hl.firstChild;
  tag.replaceChildren(icon(t.type === "photo" ? "photo" : t.type === "review" ? "quote" : "edit"), labelOf(t));
  if (t.type === "text" && t.ts.some((x) => changed(x))) tag.append(h("em", {}, "not live yet"));
  hl.hidden = false;
}

/* ---------------- 4. editing text in place ---------------- */
let active = null; // the text being typed into

const pop = h("div", { class: "vs-pop", hidden: true, onmousedown: (e) => { if (!/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) e.preventDefault(); } });
function placePop(anchor) {
  if (pop.hidden) return;
  if (narrow()) { pop.classList.add("vs-pop-docked"); pop.style.left = pop.style.top = ""; return; }
  pop.classList.remove("vs-pop-docked");
  const b = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, ph = pop.offsetHeight;
  let top = b.bottom + 12;
  if (top + ph > innerHeight - 90) top = Math.max(12, b.top - ph - 12);
  const left = Math.min(Math.max(12, b.left), innerWidth - w - 12);
  pop.style.left = `${left}px`; pop.style.top = `${top}px`;
}
function follow() {
  if (!active) return;
  placePop(active.span);
  requestAnimationFrame(follow);
}

function startText({ node, ts }) {
  const t = ts[0];
  const [, lead, core, trail] = parts(node.nodeValue);
  const span = h("span", { class: "vs-editing", spellcheck: "true", lang: LANG === "hi" && t.x ? "hi" : "en" });
  span.textContent = norm(core);
  span.contentEditable = "plaintext-only";
  if (span.contentEditable !== "plaintext-only") span.contentEditable = "true";
  const leadN = document.createTextNode(lead), trailN = document.createTextNode(trail);
  const parent = node.parentNode;
  parent.replaceChild(trailN, node);
  parent.insertBefore(span, trailN);
  parent.insertBefore(leadN, span);
  active = { span, leadN, trailN, ts, before: norm(core) };
  showHL(null);
  span.addEventListener("keydown", onEditKey);
  span.addEventListener("input", textWarnings);
  span.addEventListener("paste", (e) => {
    e.preventDefault();
    document.execCommand("insertText", false, norm(e.clipboardData.getData("text/plain")));
  });
  span.focus({ preventScroll: true });
  const sel = getSelection();
  sel.selectAllChildren(span);
  textPop();
  requestAnimationFrame(follow);
}
function onEditKey(e) {
  e.stopPropagation(); // the page's own keys (Escape closes the record card...) stay quiet
  if (e.key === "Enter") { e.preventDefault(); endText(true); }
  else if (e.key === "Escape") { e.preventDefault(); endText(false); }
  else if (e.key === "Tab") { e.preventDefault(); endText(true); }
  else if (e.key === " " && active.span.closest("button, summary, a, label")) {
    // inside a button the space bar would press it instead of typing a space
    e.preventDefault();
    document.execCommand("insertText", false, " ");
  }
}
async function endText(save, value = null) {
  if (!active) return;
  const { span, leadN, trailN, ts, before } = active;
  active = null;
  pop.hidden = true;
  let next = value ?? norm(span.textContent);
  if (!save || !next) next = before;
  const n = document.createTextNode(leadN.nodeValue + before + trailN.nodeValue);
  span.parentNode.replaceChild(n, span);
  leadN.remove(); trailN.remove();
  if (next !== before) await setText(ts, next);
}

function textPop() {
  const { ts } = active;
  const t = ts[0];
  const orig = original(t, sameOnBoth(t) ? "en" : LANG);
  const isOrig = active.before === orig;
  const notes = [];
  const times = ts.reduce((n, x) => n + (x.n || 1), 0);
  if (times > 1) notes.push(`This text appears ${times} times on the site. All of them change.`);
  if (LANG === "hi" && sameOnBoth(t)) notes.push("Numbers and prices are the same on the English page, so it changes there too.");
  else if (t.x) notes.push(`Changes the ${LANG_NAME[LANG]} page only.`);
  pop.replaceChildren(...[
    h("div", { class: "vs-pop-head" }, h("strong", {}, t.t), h("span", {}, t.s)),
    ...notes.map((n) => h("p", { class: "vs-note" }, n)),
    isOrig ? null : h("p", { class: "vs-orig" }, h("span", {}, "Original: "), quoteOf(orig, 140), " ",
      h("button", { type: "button", class: "vs-link", onclick: () => endText(true, orig) }, "Use original")),
    h("p", { class: "vs-warn", hidden: true }),
    h("div", { class: "vs-pop-foot" },
      h("span", { class: "vs-keys" }, touch ? "" : "Enter saves, Esc cancels"),
      h("button", { type: "button", class: "vs-btn", onclick: () => endText(false) }, "Cancel"),
      h("button", { type: "button", class: "vs-btn vs-primary", onclick: () => endText(true) }, "Save"),
    ),
  ].filter(Boolean));
  pop.hidden = false;
  placePop(active.span);
}
function textWarnings() {
  if (!active) return;
  const v = norm(active.span.textContent);
  const t = active.ts[0];
  const warn = $(".vs-warn", pop);
  const orig = original(t, sameOnBoth(t) ? "en" : LANG);
  const msg = !v ? "Text can't be empty."
    : v.length > orig.length * 1.6 && v.length > orig.length + 24 ? "Much longer than before. Check how it looks on a phone after saving."
    : "";
  warn.textContent = msg;
  warn.hidden = !msg;
}

// the hint inside a form field, edited in the bubble
function startHint({ el, ts }) {
  const t = ts[0];
  const field = h("input", { type: "text", class: "vs-input", value: el.placeholder, "aria-label": "Hint inside the field" });
  const save = async () => { pop.hidden = true; if (norm(field.value) !== norm(el.placeholder)) await setText(ts, field.value); };
  field.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") save(); if (e.key === "Escape") pop.hidden = true; });
  pop.replaceChildren(
    h("div", { class: "vs-pop-head" }, h("strong", {}, "Hint inside the field"), h("span", {}, t.s)),
    h("p", { class: "vs-note" }, "Visitors see it in the empty field, before they type."),
    field,
    h("div", { class: "vs-pop-foot" },
      h("button", { type: "button", class: "vs-btn", onclick: () => { pop.hidden = true; } }, "Cancel"),
      h("button", { type: "button", class: "vs-btn vs-primary", onclick: save }, "Save")),
  );
  pop.hidden = false;
  placePop(el);
  field.focus(); field.select();
}

/* ---------------- 5. photos ----------------
   site_text "img:<original path>" = {"src","w","h","pos"} in `en`. The build swaps the photo on both pages. */
const photoRow = (k) => { try { return JSON.parse(saved.get(`img:${k}`)?.en || "null"); } catch (e) { return null; } };
function photoNow(k) {
  const p = photos.find((x) => x.k === k);
  const s = photoRow(k);
  return { src: s?.src || null, w: s?.src ? s.w : p.w, h: s?.src ? s.h : p.h, pos: s?.pos || p.pos };
}
function photoLive(k) {
  const p = photos.find((x) => x.k === k);
  return { src: p.b?.src || null, pos: p.b?.pos || p.pos };
}
function revertPhoto(k) {
  const p = photos.find((x) => x.k === k);
  return savePhoto(k, { src: p.b?.src || null, w: p.b?.src ? p.b.w : p.w, h: p.b?.src ? p.b.h : p.h, pos: p.b?.pos || p.pos });
}
const photoChanged = (k) => { const a = photoNow(k), b = photoLive(k); return a.src !== b.src || a.pos !== b.pos; };
function showPhoto(k) {
  const s = photoNow(k);
  for (const img of $$("img")) {
    if (img.closest(".vs-ui") || photoKey(img) !== k) continue;
    img.dataset.vsImg = k;
    const src = s.src || ROOT + k;
    if (img.getAttribute("src") !== src) {
      img.removeAttribute("srcset");
      img.setAttribute("src", src);
      if (s.w && s.h) { img.setAttribute("width", s.w); img.setAttribute("height", s.h); }
    }
    img.style.objectPosition = s.pos;
  }
}
async function savePhoto(k, patch) {
  const p = photos.find((x) => x.k === k);
  const next = { ...photoNow(k), ...patch };
  const isOriginal = !next.src && next.pos === p.pos;
  const key = `img:${k}`;
  const prev = saved.get(key);
  if (isOriginal) saved.delete(key);
  else saved.set(key, { key, en: JSON.stringify({ src: next.src, w: next.w, h: next.h, pos: next.pos }), hi: null });
  showPhoto(k); updateDock();
  saving++; updateDock();
  const { error } = isOriginal
    ? (prev ? await sb.from("site_text").delete().eq("key", key) : { error: null })
    : await sb.from("site_text").upsert(saved.get(key), { onConflict: "key" });
  saving--;
  if (error) {
    if (prev) saved.set(key, prev); else saved.delete(key);
    showPhoto(k); updateDock();
    toast(`Not saved: ${error.message}`, "error");
    return false;
  }
  updateDock();
  return true;
}

// resized in the browser: big enough for a sharp full-width photo, small enough to load fast
async function preparePhoto(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => createImageBitmap(file));
  const s = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * s), hgt = Math.round(bmp.height * s);
  const c = document.createElement("canvas");
  c.width = w; c.height = hgt;
  c.getContext("2d").drawImage(bmp, 0, 0, w, hgt);
  let blob = await new Promise((r) => c.toBlob(r, "image/webp", 0.84));
  if (!blob || blob.type !== "image/webp") blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
  return { blob, w, h: hgt };
}

const sheet = h("aside", { class: "vs-sheet", hidden: true, role: "dialog", "aria-modal": "false" });
function openSheet(title, ...body) {
  closeSheets();
  sheet.replaceChildren(
    h("div", { class: "vs-sheet-head" }, h("h2", {}, title),
      h("button", { type: "button", class: "vs-icon-btn", "aria-label": "Close", onclick: closeSheets }, icon("close"))),
    h("div", { class: "vs-sheet-body" }, ...body),
  );
  sheet.setAttribute("aria-label", title);
  sheet.hidden = false;
  return sheet;
}
function closeSheets() {
  sheet.hidden = true;
  changesPanel.hidden = true;
  $("#vs-changes-btn")?.setAttribute("aria-expanded", "false");
}

function openPhoto(k) {
  const p = photos.find((x) => x.k === k);
  const img = $$("img").find((i) => !i.closest(".vs-ui") && photoKey(i) === k);
  const s = photoNow(k);
  const preview = h("img", { src: s.src || ROOT + k, alt: "" });
  const dot = h("span", { class: "vs-focus-dot" });
  const placeDot = (pos) => { const [x, y] = pos.split(" "); dot.style.left = x; dot.style.top = y; };
  placeDot(s.pos);
  let posT;
  const frame = h("div", { class: "vs-photo-frame", onclick: (e) => {
    const b = preview.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - b.left) / b.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - b.top) / b.height) * 100)));
    const pos = `${x}% ${y}%`;
    placeDot(pos);
    for (const i of $$("img")) if (!i.closest(".vs-ui") && photoKey(i) === k) i.style.objectPosition = pos;
    clearTimeout(posT);
    posT = setTimeout(async () => { if (await savePhoto(k, { pos })) toast("Focus point saved."); }, 350);
  } }, preview, dot);
  const file = h("input", { type: "file", accept: "image/*", hidden: true });
  const status = h("p", { class: "vs-note", role: "status" });
  const replace = h("button", { type: "button", class: "vs-btn vs-primary", onclick: () => file.click() }, icon("up"), "Replace photo");
  file.addEventListener("change", async () => {
    const f = file.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type)) { status.textContent = "That file isn't a photo. Choose a JPG, PNG, WebP or HEIC photo."; return; }
    replace.classList.add("is-loading"); replace.disabled = true;
    status.textContent = "Preparing the photo…";
    try {
      const { blob, w, h: hgt } = await preparePhoto(f);
      status.textContent = "Uploading…";
      const slug = k.replace(/^.*\//, "").replace(/\.\w+$/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
      const path = `${slug}-${Date.now().toString(36)}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000", upsert: false });
      if (up.error) throw up.error;
      const src = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      if (await savePhoto(k, { src, w, h: hgt, pos: "50% 50%" })) {
        preview.src = src; placeDot("50% 50%");
        status.textContent = "New photo saved. Tap it above to choose what stays in view.";
        restore.hidden = false;
      }
    } catch (x) {
      status.textContent = /HEIC|decode|source image/i.test(String(x?.message)) ? "This browser can't read that photo. Try a JPG or PNG." : `Not uploaded: ${x?.message || "try again"}`;
    } finally {
      replace.classList.remove("is-loading"); replace.disabled = false; file.value = "";
    }
  });
  const restore = h("button", { type: "button", class: "vs-btn", hidden: !s.src && s.pos === p.pos, onclick: async () => {
    if (await savePhoto(k, { src: null, w: p.w, h: p.h, pos: p.pos })) {
      preview.src = ROOT + k; placeDot(p.pos); restore.hidden = true;
      status.textContent = "Back to the original photo.";
    }
  } }, "Use the original photo");
  // the description is a text like any other, so it has a Hindi version too
  const altTs = img ? textsShowing(norm(img.alt)) : null;
  const alt = altTs ? h("textarea", { class: "vs-input", rows: "3" }) : null;
  if (alt) {
    alt.value = img.alt;
    alt.addEventListener("keydown", (e) => e.stopPropagation());
    alt.addEventListener("change", async () => {
      if (norm(alt.value) && norm(alt.value) !== current(altTs[0]) && await setText(altTs, alt.value)) toast("Description saved.");
    });
  }
  openSheet("Photo",
    frame,
    h("p", { class: "vs-note" }, "Tap the photo where the eye should go. Screens crop photos differently, and that spot always stays in view."),
    h("div", { class: "vs-row" }, replace, restore), file, status,
    alt ? h("label", { class: "vs-field" }, h("span", {}, `Description (${LANG_NAME[LANG]})`), alt,
      h("small", {}, "Read out to people who can't see the photo, and used by Google. Say what's in it.")) : null,
    h("p", { class: "vs-note vs-quiet" }, "The English and Hindi pages show the same photos."),
  );
}

/* ---------------- 6. reviews ----------------
   Saved straight to the reviews table, the same one the admin's Reviews tab and, until launch,
   the current website (vyanasoul.com) read. */
const SERVICES = ["Akashic reading", "Lama Fera healing", "Pranic Healing", "Reading and healing", "Personal consultation"];
function fillCard(card, r) {
  const quote = $("blockquote", card);
  const text = ((r.full_review || "").trim() || (r.review || "").trim()).replace(/\r\n/g, "\n");
  const lang = r.language === "hi" ? "hi" : r.language === "hinglish" ? "hi-Latn" : null;
  if (lang) quote.setAttribute("lang", lang); else quote.removeAttribute("lang");
  if (card.matches(".review-item")) quote.replaceChildren(...text.split(/\n\s*\n/).map((p) => h("p", {}, p.trim())));
  else quote.replaceChildren(h("p", {}, (r.review || "").trim() || text));
  const who = $(".r-who", card);
  if (who) who.textContent = [r.name, r.location].map((s) => (s || "").trim()).filter(Boolean).join(", ");
  const mono = $(".monogram", card);
  if (mono) mono.textContent = [...(r.name || "").trim().replace(/^(Mr|Ms|Mrs|Dr)\.?\s+/i, "")][0] || "";
  let what = $(".r-what", card);
  if (r.service && !what) { what = h("span", { class: "r-what" }); who?.after(what); }
  if (what) { what.textContent = (r.service || "").trim(); what.hidden = !r.service; }
  card.classList.toggle("vs-off", r.published === false);
}
function openReview(card) {
  const id = card?.dataset.review || null;
  const r = id ? reviews.get(id) : null;
  if (id && !r) {
    openSheet("Review",
      h("p", {}, "This is one of the four reviews the current website shows from its own code. It moves into the database when the new website launches, and you can edit it here after that."));
    return;
  }
  const f = (label, el, hint) => h("label", { class: "vs-field" }, h("span", {}, label), el, hint ? h("small", {}, hint) : null);
  const name = h("input", { class: "vs-input", value: (r?.name || "").trim(), autocomplete: "off" });
  const place = h("input", { class: "vs-input", value: (r?.location || "").trim(), autocomplete: "off" });
  const svc = (r?.service || "").trim();
  const service = h("select", { class: "vs-input" },
    ...SERVICES.map((s) => h("option", { value: s, selected: s === svc || (!r && s === SERVICES[0]) || (/^ak/i.test(svc) && s === SERVICES[0]) }, s)),
    h("option", { value: "", selected: !!r && !svc }, "Not shown"));
  const language = h("select", { class: "vs-input" },
    ...[["en", "English"], ["hi", "Hindi"], ["hinglish", "Hinglish"]].map(([v, l]) => h("option", { value: v, selected: (r?.language || "en") === v }, l)));
  const short = h("textarea", { class: "vs-input", rows: "4" });
  short.value = r?.review || "";
  const full = h("textarea", { class: "vs-input", rows: "6" });
  full.value = r?.full_review && r.full_review !== r.review ? r.full_review : "";
  const consent = h("input", { type: "checkbox", checked: !!r?.consent_obtained });
  const shown = h("input", { type: "checkbox", checked: r ? r.published !== false : true });
  const featured = h("input", { type: "checkbox", checked: !!r?.featured });
  const err = h("p", { class: "vs-warn", hidden: true, role: "alert" });
  for (const el of [name, place, short, full]) el.addEventListener("keydown", (e) => e.stopPropagation());
  const save = h("button", { type: "submit", class: "vs-btn vs-primary" }, r ? "Save review" : "Add review");
  const form = h("form", { class: "vs-form", novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    const row = {
      name: name.value.trim(), location: place.value.trim(), service: service.value, language: language.value,
      review: short.value.trim(), full_review: full.value.trim() || short.value.trim(), rating: r?.rating || 5,
      consent_obtained: consent.checked, published: shown.checked, featured: featured.checked,
    };
    if (!row.name || !row.review) { err.textContent = "Add the client's name and the review."; err.hidden = false; (row.name ? short : name).focus(); return; }
    if (row.published && !row.consent_obtained && !confirm("You haven't ticked that the client agreed. Show this review on the website anyway?")) return;
    save.classList.add("is-loading");
    const q = r ? sb.from("reviews").update(row).eq("id", r.id).select().single() : sb.from("reviews").insert(row).select().single();
    const { data, error } = await q;
    save.classList.remove("is-loading");
    if (error) { err.textContent = `Not saved: ${error.message}`; err.hidden = false; return; }
    reviews.set(data.id, data);
    if (card) fillCard(card, data);
    else addCard(data);
    closeSheets(); updateDock();
    toast(r ? "Review saved. Visitors see it after you publish." : "Review added. It takes its place among the others when you publish.");
  } },
    f("Client's name", name), f("Place", place, "City or country. Leave empty to leave it out."),
    h("div", { class: "vs-row vs-row-2" }, f("Session", service), f("Language", language)),
    f("Review", short, "What the page shows on the review cards."),
    f("Longer version (optional)", full, "Shown under “Read more reviews”. Leave empty to use the review above."),
    h("label", { class: "vs-check" }, consent, h("span", {}, "The client agreed to their review being on the website")),
    h("label", { class: "vs-check" }, shown, h("span", {}, "Show on the website")),
    h("label", { class: "vs-check" }, featured, h("span", {}, "Feature it (featured reviews come first)")),
    err,
    h("div", { class: "vs-row vs-sheet-actions" },
      r ? h("button", { type: "button", class: "vs-btn vs-danger", onclick: async () => {
        if (!confirm(`Delete the review from ${r.name.trim()}? This can't be undone.`)) return;
        const { error } = await sb.from("reviews").delete().eq("id", r.id);
        if (error) { err.textContent = `Not deleted: ${error.message}`; err.hidden = false; return; }
        reviews.delete(r.id);
        card.remove(); closeSheets(); updateDock();
        toast("Review deleted.");
      } }, "Delete") : null,
      h("button", { type: "button", class: "vs-btn", onclick: closeSheets }, "Cancel"),
      save),
  );
  openSheet(r ? "Edit review" : "Add a review", form,
    h("p", { class: "vs-note vs-quiet" }, "Reviews are shared with the current website (vyanasoul.com) until the new one launches, so changes show there too."));
  name.focus();
}
function addCard(r) {
  let list = $(".review-list");
  if (!list) {
    const grid = $(".review-grid");
    list = h("div", { class: "review-list" });
    grid?.after(list);
  }
  const card = h("article", { class: "review-item vs-new", "data-review": r.id },
    h("blockquote", { translate: "no" }),
    h("div", { class: "r-meta" }, h("span", { class: "monogram", "aria-hidden": "true", translate: "no" }),
      h("span", {}, h("span", { class: "r-who", translate: "no" }))));
  list.prepend(card);
  fillCard(card, r);
  card.closest("details")?.setAttribute("open", "");
  card.scrollIntoView({ block: "center", behavior: "smooth" });
}

/* ---------------- 7. all text ----------------
   Everything, searchable: for text that can't be clicked on the page (Google's description,
   booking-form messages, words only screen readers hear) and for finding things fast. */
const offPage = (t) => isJs(t) || t.s === "Google and sharing" || /read aloud|Tooltip|Loading message|Read aloud by screen readers/.test(t.t) || !t.p.split(" ").includes(PAGE);
function onPage(t) {
  const v = current(t);
  let hit = null;
  eachText((n) => { if (!hit && norm(n.nodeValue) === v && visible(n.parentElement)) hit = n; });
  return hit;
}
function textRow(t) {
  const lang = LANG === "hi" && sameOnBoth(t) ? "en" : LANG;
  const field = h("textarea", { class: "vs-input", rows: String(Math.min(6, Math.ceil(current(t, lang).length / 46) || 1)), lang: lang === "hi" ? "hi" : "en" });
  field.value = current(t, lang);
  field.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); field.blur(); }
  });
  const state = h("small", {});
  const paint = () => {
    const orig = original(t, lang);
    state.replaceChildren(current(t, lang) !== orig ? h("button", { type: "button", class: "vs-link", onclick: async () => {
      if (await setText([t], orig, lang)) { field.value = orig; paint(); }
    } }, "Use original") : "");
    if (changed(t, LANG)) state.prepend(h("span", { class: "vs-pill" }, "not live yet"), " ");
  };
  paint();
  field.addEventListener("change", async () => {
    if (!norm(field.value)) { field.value = current(t, lang); toast("Text can't be empty.", "error"); return; }
    if (norm(field.value) !== current(t, lang) && await setText([t], field.value, lang)) paint();
  });
  const node = !offPage(t) ? onPage(t) : null;
  return h("li", { class: "vs-text-row" },
    h("div", { class: "vs-text-meta" }, h("strong", {}, t.t), h("span", {}, t.s),
      node ? h("button", { type: "button", class: "vs-link", onclick: () => {
        closeSheets();
        node.parentElement.scrollIntoView({ block: "center" });
        setTimeout(() => { const n = onPage(t); if (n) startText({ node: n, ts: textsShowing(current(t)) || [t] }); }, 450);
      } }, "Show on the page") : null),
    field, state);
}
function openAllText() {
  const search = h("input", { type: "search", class: "vs-input", placeholder: "Search, for example: fee, Sunday, WhatsApp", "aria-label": "Search the website's text" });
  const list = h("ul", { class: "vs-text-list" });
  const summary = h("p", { class: "vs-note" });
  const render = () => {
    const q = norm(search.value).toLowerCase();
    const mine = texts.filter((t) => LANG === "en" || t.x || !isJs(t));
    let shown;
    if (q) {
      shown = mine.filter((t) => [current(t), original(t), t.en, t.s, t.t].some((v) => (v || "").toLowerCase().includes(q))).slice(0, 80);
      summary.textContent = shown.length ? `${shown.length >= 80 ? "The first 80" : shown.length} ${shown.length === 1 ? "text" : "texts"} with “${search.value.trim()}”.` : `Nothing on the ${LANG_NAME[LANG]} page has “${search.value.trim()}”.`;
    } else {
      shown = mine.filter(offPage);
      summary.textContent = "Text you can't click on the page: what Google shows, the booking form's messages, words only screen readers hear, and the privacy page. Search to find anything else.";
    }
    list.replaceChildren(...shown.map(textRow));
  };
  let st;
  search.addEventListener("input", () => { clearTimeout(st); st = setTimeout(render, 160); });
  search.addEventListener("keydown", (e) => e.stopPropagation());
  render();
  openSheet(`All text, ${LANG_NAME[LANG]} page`, search, summary, list);
  sheet.classList.add("vs-sheet-wide");
  search.focus();
}

/* ---------------- 8. the dock: changes and publish ---------------- */
let mode = "edit";
const dock = h("nav", { class: "vs-dock", "aria-label": "Edit mode" });
const changesPanel = h("div", { class: "vs-changes", hidden: true, id: "vs-changes" });

function pendingList() {
  const out = [];
  for (const t of texts) for (const lang of ["en", "hi"]) {
    if (lang === "hi" && sameOnBoth(t)) continue;
    if (current(t, lang) !== published(t, lang)) out.push({ kind: "text", t, lang });
  }
  for (const p of photos) if (photoChanged(p.k)) out.push({ kind: "photo", k: p.k });
  for (const r of reviews.values()) if (builtAt && (r.updated_at || r.created_at) > builtAt) out.push({ kind: "review", r });
  return out;
}
function updateDock() {
  const n = pendingList().length;
  const btn = $("#vs-changes-btn");
  if (!btn) return;
  const count = btn.querySelector(".vs-count");
  if (saving) count.textContent = "Saving…";
  else if (!n) count.textContent = narrow() ? "All live" : "All changes live";
  else if (narrow()) count.replaceChildren(String(n), h("span", { class: "vs-hide-xs" }, " not live"));
  else count.textContent = `${n} ${n === 1 ? "change" : "changes"} not live`;
  btn.setAttribute("aria-label", n ? `${n} ${n === 1 ? "change" : "changes"} not live yet` : "All changes are live");
  btn.classList.toggle("vs-has", n > 0);
  $("#vs-publish").disabled = n === 0 && !saving;
  if (!changesPanel.hidden) renderChanges();
}
function renderChanges() {
  const items = pendingList();
  const row = (title, body, undo) => h("li", {},
    h("div", { class: "vs-text-meta" }, h("strong", {}, title), undo ? h("button", { type: "button", class: "vs-link", onclick: undo }, "Undo") : null),
    body);
  changesPanel.replaceChildren(
    h("div", { class: "vs-sheet-head" }, h("h2", {}, items.length ? "Not live yet" : "Everything is live"),
      h("button", { type: "button", class: "vs-icon-btn", "aria-label": "Close", onclick: closeSheets }, icon("close"))),
    items.length
      ? h("p", { class: "vs-note" }, "Saved, and only you can see them here. Press Publish to show them to everyone.")
      : h("p", { class: "vs-note" }, "Visitors see exactly what you see. Click any text, photo or review to change it."),
    h("ul", { class: "vs-change-list" }, ...items.map((c) => {
      if (c.kind === "text") {
        const pageName = c.lang !== LANG ? ` (${LANG_NAME[c.lang]} page)` : "";
        return row(`${c.t.t}${pageName}`, h("p", {}, h("del", {}, quoteOf(published(c.t, c.lang), 70)), h("br"), h("ins", {}, quoteOf(current(c.t, c.lang), 70))),
          () => setText([c.t], published(c.t, c.lang), c.lang));
      }
      if (c.kind === "photo") return row("Photo", h("p", {}, `${c.k.replace(/^.*\//, "")}: ${photoNow(c.k).src !== photoLive(c.k).src ? "new photo" : "new focus point"}`),
        () => revertPhoto(c.k));
      return row("Review", h("p", {}, `${(c.r.name || "").trim()}: ${c.r.published === false ? "hidden" : "edited or added"}`));
    })),
    h("div", { class: "vs-row vs-sheet-actions" }, publishButton(true)),
  );
}
function publishButton(big = false) {
  return h("button", { type: "button", class: `vs-btn vs-primary${big ? " vs-wide" : ""}`, onclick: publish }, "Publish");
}
async function publish(e) {
  const btn = e.currentTarget;
  if (saving) { toast("Still saving. Try again in a moment."); return; }
  btn.classList.add("is-loading");
  const { data } = await sb.auth.getSession();
  const res = await fetch(`${FN}/rebuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
    body: "{}",
  }).catch(() => null);
  btn.classList.remove("is-loading");
  const status = res?.status;
  if (status === 202) toast("Publishing. Visitors see your changes in about a minute.");
  else if (status === 501) toast("Publishing switches on when the new website launches. Your changes are saved; the developer can publish this preview for you.", "error");
  else toast("Publishing didn't start. Check the connection and try again in a minute.", "error");
}

function setMode(m) {
  mode = m;
  html.classList.toggle("vs-browse", m === "browse");
  $$(".vs-mode button", dock).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
  if (m === "browse") { showHL(null); if (active) endText(true); pop.hidden = true; }
  liveChapters();
  toast(m === "edit" ? (touch ? "Tap any text, photo or review to change it." : "Click any text, photo or review to change it.") : "Use the page as a visitor would. Switch back to Edit to make changes.");
}

function buildDock() {
  const otherHref = LANG === "en" ? "hi/?edit" : `${ROOT}?edit`;
  dock.replaceChildren(
    h("div", { class: "vs-mode", role: "group", "aria-label": "Mode" },
      h("button", { type: "button", "data-mode": "edit", "aria-pressed": "true", onclick: () => setMode("edit") }, icon("edit"), h("span", {}, "Edit")),
      h("button", { type: "button", "data-mode": "browse", "aria-pressed": "false", onclick: () => setMode("browse") }, icon("browse"), h("span", {}, "Browse"))),
    h("div", { class: "vs-langs", role: "group", "aria-label": "Page" },
      h("a", { href: LANG === "en" ? "#" : otherHref, "aria-current": LANG === "en" ? "page" : null, lang: "en" }, "EN"),
      h("a", { href: LANG === "hi" ? "#" : otherHref, "aria-current": LANG === "hi" ? "page" : null, lang: "hi" }, "हिं")),
    h("button", { type: "button", class: "vs-dock-btn", onclick: openAllText, title: "All text" }, icon("search"), h("span", { class: "vs-hide-s" }, "All text")),
    h("button", { type: "button", class: "vs-dock-btn vs-changes-btn", id: "vs-changes-btn", "aria-expanded": "false", "aria-controls": "vs-changes", onclick: () => {
      const open = changesPanel.hidden;
      closeSheets();
      if (open) { renderChanges(); changesPanel.hidden = false; $("#vs-changes-btn").setAttribute("aria-expanded", "true"); }
    } }, icon("dot"), h("span", { class: "vs-count" }, "")),
    Object.assign(publishButton(), { id: "vs-publish" }),
    h("a", { class: "vs-icon-btn", href: location.pathname, title: "Leave edit mode", "aria-label": "Leave edit mode" }, icon("close")),
  );
}

// chapters of the opening film sit in a layer that ignores the pointer; while editing, the
// one on screen takes clicks so its words can be edited
function liveChapters() {
  for (const ch of $$(".chapter")) ch.classList.toggle("vs-live", mode === "edit" && visible(ch));
}

/* ---------------- 9. start ---------------- */
function gate(title, text, actions) {
  ui.append(h("div", { class: "vs-gate", role: "dialog", "aria-label": title },
    h("div", { class: "vs-gate-card" }, h("h2", {}, title), h("p", {}, text), h("div", { class: "vs-row" }, ...actions))));
  document.body.append(ui);
}

async function start() {
  const css = h("link", { rel: "stylesheet", href: `${ROOT}edit.css` });
  document.head.append(css);
  const leave = h("a", { class: "vs-btn", href: location.pathname }, "View the website");

  const { data } = await sb.auth.getSession();
  const session = data.session;
  if (!session) {
    gate("Sign in to edit the website", "Edit mode is for Rekha and the site's developer. Sign in with your admin account and you'll come straight back here.",
      [h("a", { class: "vs-btn vs-primary", href: `${ROOT}admin/?next=${encodeURIComponent(location.pathname + "?edit")}` }, "Sign in"), leave]);
    return;
  }
  const [profile, list, db, rv] = await Promise.all([
    sb.from("profiles").select("role").eq("id", session.user.id).maybeSingle(),
    fetch(`${ROOT}admin/texts.json`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    sb.from("site_text").select("key,en,hi"),
    sb.from("reviews").select("*"),
  ]);
  if (profile.data?.role !== "admin") {
    try { localStorage.removeItem("vs-admin"); } catch (e) {}
    gate("This account can't edit the website", `${session.user.email} isn't one of the site's admin accounts. Sign in with Rekha's account or the developer's.`,
      [h("a", { class: "vs-btn vs-primary", href: `${ROOT}admin/` }, "Go to the admin"), leave]);
    return;
  }
  if (!list || db.error) {
    gate("Edit mode couldn't start", !list ? "The list of the website's text is missing. Ask the developer to rebuild the site." : `The saved changes couldn't be loaded: ${db.error.message}`, [leave]);
    return;
  }
  try { localStorage.setItem("vs-admin", "1"); } catch (e) {}

  texts = list.texts;
  photos = list.photos || [];
  builtAt = list.builtAt;
  pageTexts = texts.filter((t) => !isJs(t) && t.p.split(" ").includes(PAGE));
  saved = new Map(db.data.map((r) => [r.key, r]));
  reviews = new Map((rv.data || []).map((r) => [r.id, r]));

  // the page as saved, not as published: put saved changes in place
  const hero = $(".chapter-hero h1");
  if (hero?.querySelector(".hw")) hero.textContent = norm(hero.textContent); // fx.js split it into words for the reveal
  for (const t of pageTexts) if (changed(t)) swapText(published(t), current(t));
  for (const p of photos) if (photoChanged(p.k)) showPhoto(p.k);
  for (const card of $$("[data-review]")) {
    const r = reviews.get(card.dataset.review);
    if (r && (r.updated_at || r.created_at) > builtAt) fillCard(card, r);
  }
  $$("details").forEach((d) => { d.open = true; }); // answers and all reviews, ready to edit
  rebuildIndex();
  markChanges();

  // the editor's own furniture
  buildDock();
  ui.append(hl, pop, sheet, changesPanel, dock, toastEl);
  document.body.append(ui);
  const addReview = h("button", { type: "button", class: "vs-btn vs-primary vs-add-review vs-ui", onclick: () => openReview(null) }, "+ Add a review");
  $("#reviews-h")?.after(addReview);
  updateDock();
  liveChapters();
  html.classList.add("vs-ready");
  toast(touch ? "Edit mode. Tap any text, photo or review to change it." : "Edit mode. Click any text, photo or review to change it.");

  // pointer: highlight what a click would edit
  let raf = 0, px = 0, py = 0;
  addEventListener("pointermove", (e) => {
    if (mode !== "edit" || active || e.pointerType === "touch") return;
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (mode === "edit" && !active) showHL(targetAt(px, py)); });
  }, { passive: true });
  addEventListener("scroll", () => { showHL(null); liveChapters(); }, { passive: true });
  document.addEventListener("pointerleave", () => showHL(null));

  // clicks edit instead of following links or pressing buttons
  const inEditor = (e) => e.target.closest?.(".vs-ui, .vs-editing");
  for (const type of ["pointerdown", "mousedown"]) {
    addEventListener(type, (e) => {
      if (mode !== "edit" || inEditor(e)) return;
      e.stopPropagation();
      if (type === "mousedown") e.preventDefault();
    }, true);
  }
  addEventListener("click", (e) => {
    if (mode !== "edit") return;
    if (e.target.closest?.(".vs-editing")) { e.preventDefault(); return; }
    if (e.target.closest?.(".vs-ui")) return;
    e.preventDefault(); e.stopPropagation();
    if (active) { endText(true); return; }
    if (!pop.hidden) { pop.hidden = true; return; }
    const t = targetAt(e.clientX, e.clientY);
    if (!t) return;
    showHL(null);
    if (t.type === "text") startText(t);
    else if (t.type === "hint") startHint(t);
    else if (t.type === "photo") openPhoto(t.key);
    else if (t.type === "review") openReview(t.el);
  }, true);
  addEventListener("submit", (e) => { if (mode === "edit" && !e.target.closest(".vs-ui")) e.preventDefault(); }, true);
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !active) { if (!pop.hidden) pop.hidden = true; else closeSheets(); }
  });
  addEventListener("beforeunload", (e) => { if (active || saving) { e.preventDefault(); e.returnValue = ""; } });
  addEventListener("resize", () => { if (!pop.hidden && active) placePop(active.span); });
}

start().catch((x) => {
  console.error(x);
  toast(`Edit mode stopped: ${x?.message || x}`, "error");
});
