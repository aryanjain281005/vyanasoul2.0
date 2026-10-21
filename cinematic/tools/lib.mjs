// Helpers shared by build.mjs and check.mjs.
import { parse } from "node-html-parser";

export const PARSE_OPTS = { comment: true, blockTextElements: { script: true, noscript: true, style: true, pre: true } };

export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s) => s
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
  .replace(/&#39;|&#x27;|&apos;/g, "'").replace(/&amp;/g, "&");
const encodeText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const norm = (s) => decode(s).replace(/\s+/g, " ").trim();

/** Split "<!doctype html>" off the front: the parser drops it. */
export function parseDocument(html) {
  const m = html.match(/^\s*<!doctype[^>]*>\s*/i);
  return { doctype: m ? m[0].trim() : "<!doctype html>", root: parse(m ? html.slice(m[0].length) : html, PARSE_OPTS) };
}
export const serialize = ({ doctype, root }) => `${doctype}\n${root.toString()}\n`;

// Parts of the page that are never translated
const SKIP_TAGS = new Set(["script", "style", "noscript", "svg", "code", "pre", "template"]);
const ATTRS = ["aria-label", "placeholder", "alt", "title", "data-building", "data-ready"];
const META_CONTENT = /^(description|og:title|og:description|twitter:title|twitter:description)$/;
// Strings with no letters (numbers, prices, phone numbers) and addresses need no translation
const NEEDS_TRANSLATION = (key) => /[A-Za-z].*[A-Za-z]/.test(key) && !/^[\w.+-]+@[\w.-]+$/.test(key) && !/^\+?[\d\s()-]+$/.test(key);

/**
 * Translate every text node and user-facing attribute under `root` with `dict`
 * (English text -> other language, whitespace-normalised). Elements marked translate="no",
 * or already in another language (lang="sa", lang="hi"...), are left alone.
 * Returns the English strings that had no translation; `used` collects the ones that had one.
 */
export function translate(root, dict, used = null) {
  const missing = new Set();
  const look = (raw) => {
    const key = norm(raw);
    if (!key || !NEEDS_TRANSLATION(key)) return null;
    if (Object.prototype.hasOwnProperty.call(dict, key)) { used?.add(key); return dict[key]; }
    missing.add(key);
    return null;
  };
  const walk = (node) => {
    if (node.nodeType === 3) {
      const raw = node.rawText;
      const t = look(raw);
      if (t !== null) {
        const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        node.rawText = lead + encodeText(t) + trail;
      }
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = (node.rawTagName || "").toLowerCase();
    if (SKIP_TAGS.has(tag)) return;
    if (node.getAttribute("translate") === "no") return;
    const lang = node.getAttribute("lang");
    if (lang && tag !== "html" && !/^en\b/i.test(lang)) return;
    for (const a of ATTRS) {
      const v = node.getAttribute(a);
      if (v == null) continue;
      const t = look(v);
      if (t !== null) node.setAttribute(a, t);
    }
    if (tag === "meta") {
      const name = node.getAttribute("name") || node.getAttribute("property") || "";
      if (META_CONTENT.test(name)) {
        const t = look(node.getAttribute("content") || "");
        if (t !== null) node.setAttribute("content", t);
      }
    }
    node.childNodes.forEach(walk);
  };
  walk(root);
  return [...missing];
}

/** Prefix relative URLs (assets, scripts, other pages) for a page one folder down. */
export function rebaseUrls(root, prefix, keep = []) {
  // `keep`: page paths that exist in this folder too (links between translated pages)
  const relative = (v) => v && !/^(#|[a-z][a-z0-9+.-]*:|\/)/i.test(v) && !keep.includes(v.split("#")[0]);
  for (const el of root.querySelectorAll("[src], [href], [srcset]")) {
    for (const a of ["src", "href"]) {
      const v = el.getAttribute(a);
      if (relative(v)) el.setAttribute(a, prefix + v);
    }
    const ss = el.getAttribute("srcset");
    if (ss) el.setAttribute("srcset", ss.split(",").map((part) => {
      const p = part.trim();
      return relative(p) ? prefix + p : p;
    }).join(", "));
  }
  for (const ns of root.querySelectorAll("noscript, style")) {
    const raw = ns.innerHTML;
    if (/url\((?!["']?(data:|https?:|\/))/.test(raw)) ns.set_content(raw.replace(/url\((["']?)(?!data:|https?:|\/)/g, `url($1${prefix}`));
  }
}

/** Every href="#id" on the page points at an element that exists. */
export function brokenAnchors(root) {
  const ids = new Set(root.querySelectorAll("[id]").map((e) => e.getAttribute("id")));
  return [...new Set(root.querySelectorAll('a[href^="#"]').map((a) => a.getAttribute("href").slice(1)).filter((id) => id && !ids.has(id)))];
}
