// Build the deployable site into dist/.
//
//   node tools/build.mjs --target=production   www.vyanasoul.com, indexable
//   node tools/build.mjs --target=preview      GitHub Pages preview, noindex
//
// index.html, privacy.html and 404.html stay hand-edited English sources. The build:
//  - renders reviews from data/reviews.json into the page
//  - writes the Hindi pages under hi/ from the same sources and i18n/hi.json
//  - adds canonical and hreflang links, absolute social-card URLs and structured data
//  - writes robots.txt, sitemap.xml and llms.txt

import fs from "node:fs";
import path from "node:path";
import { BUSINESS, STATIC, TARGETS } from "./config.mjs";
import { brokenAnchors, esc, parseDocument, rebaseUrls, serialize, translate } from "./lib.mjs";

const SRC = path.resolve(new URL("..", import.meta.url).pathname);
const DIST = path.join(SRC, "dist");
const targetName = (process.argv.find((a) => a.startsWith("--target=")) || "").split("=")[1];
const target = TARGETS[targetName];
if (!target) {
  console.error(`Choose a target: ${Object.keys(TARGETS).map((t) => `--target=${t}`).join(" or ")}`);
  process.exit(1);
}
const BASE = target.url; // ends with "/"
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");
const today = new Date().toISOString().slice(0, 10);

const dict = JSON.parse(read("i18n/hi.json"));
const { reviews } = JSON.parse(read("data/reviews.json"));

/* ---------- reviews ---------- */
const STR = {
  en: { more: (n) => `Read ${n} more ${n === 1 ? "review" : "reviews"}` },
  hi: { more: (n) => `${n} और समीक्षाएँ पढ़ें` },
};
const langAttr = (r) => (r.language === "hi" ? ' lang="hi"' : r.language === "hinglish" ? ' lang="hi-Latn"' : "");
const who = (r) => esc([r.name, r.location].filter(Boolean).join(", "));
const paragraphs = (text) => text.split(/\n\s*\n/).map((p) => `<p>${esc(p.trim())}</p>`).join("");
const caption = (r, tag = "figcaption", cls = "") => `<${tag}${cls ? ` class="${cls}"` : ""}><span class="monogram" aria-hidden="true" translate="no">${esc([...r.name.replace(/^(Mr|Ms|Mrs|Dr)\.?\s+/i, "")][0] || "")}</span><span><span class="r-who" translate="no">${who(r)}</span>${r.service ? `<span class="r-what">${esc(r.service)}</span>` : ""}</span></${tag}>`;

function reviewsHtml(lang) {
  const featured = reviews.filter((r) => r.featured);
  const top = (featured.length ? featured : reviews).slice(0, 4);
  const [main, ...grid] = top;
  const rest = reviews.filter((r) => !top.includes(r));
  const indent = "          ";
  let html = `${indent}<figure class="review review-feature">\n${indent}  <blockquote translate="no"${langAttr(main)}><p>${esc(main.short || main.text)}</p></blockquote>\n${indent}  ${caption(main)}\n${indent}</figure>\n`;
  html += `${indent}<div class="review-grid">\n` + grid.map((r) =>
    `${indent}  <figure class="review">\n${indent}    <blockquote translate="no"${langAttr(r)}><p>${esc(r.short || r.text)}</p></blockquote>\n${indent}    ${caption(r)}\n${indent}  </figure>\n`).join("") + `${indent}</div>\n`;
  if (rest.length) {
    html += `${indent}<details class="all-reviews">\n${indent}  <summary translate="no">${STR[lang].more(rest.length)}</summary>\n${indent}  <div class="review-list">\n` +
      rest.map((r) => `${indent}    <article class="review-item">\n${indent}      <blockquote translate="no"${langAttr(r)}>${paragraphs(r.text)}</blockquote>\n${indent}      ${caption(r, "div", "r-meta")}\n${indent}    </article>\n`).join("") +
      `${indent}  </div>\n${indent}</details>\n`;
  }
  return html;
}

/* ---------- head: canonical, hreflang, social card, structured data ---------- */
const pageUrl = (lang, file = "") => BASE + (lang === "hi" ? "hi/" : "") + file;
const text = (el) => (el ? el.text.replace(/\s+/g, " ").trim() : "");

function structuredData(root, lang) {
  const url = pageUrl(lang);
  const org = { "@id": `${BASE}#org` }, rekha = { "@id": `${BASE}#rekha` };
  const services = root.querySelectorAll(".session-card").map((card) => ({
    "@type": "Service",
    name: text(card.querySelector("h3")),
    description: text(card.querySelector(".sc-main p")),
    serviceType: text(card.querySelector("h3")),
    provider: rekha,
    areaServed: "Worldwide",
    availableLanguage: ["English", "Hindi"],
    availableChannel: { "@type": "ServiceChannel", serviceUrl: `${url}#book`, availableLanguage: ["English", "Hindi"] },
  }));
  const faq = root.querySelectorAll(".faq-list details").map((d) => {
    const q = d.querySelector("summary").clone();
    q.querySelectorAll(".faq-icon").forEach((i) => i.remove());
    return { "@type": "Question", name: text(q), acceptedAnswer: { "@type": "Answer", text: text(d.querySelector(".faq-a")) } };
  });
  const graph = [
    {
      "@type": "Organization", ...org, name: BUSINESS.name, url: BASE, image: `${BASE}assets/og.jpg`,
      founder: rekha, sameAs: BUSINESS.sameAs,
      address: { "@type": "PostalAddress", addressLocality: BUSINESS.city, addressCountry: "IN" },
      contactPoint: { "@type": "ContactPoint", telephone: BUSINESS.phone.replace(/\s+/g, "-"), email: BUSINESS.email, contactType: "customer service", availableLanguage: ["English", "Hindi"] },
    },
    {
      "@type": "Person", ...rekha, name: BUSINESS.person, jobTitle: text(root.querySelector(".rekha .role")),
      image: `${BASE}assets/rekha-portrait.webp`, worksFor: org, sameAs: BUSINESS.sameAs,
      knowsAbout: ["Akashic Records", "Lama Fera", "Pranic Healing"],
    },
    { "@type": "WebSite", "@id": `${BASE}#website`, url: BASE, name: BUSINESS.name, inLanguage: ["en", "hi"], publisher: org },
    { "@type": "WebPage", "@id": `${url}#page`, url, name: text(root.querySelector("title")), description: root.querySelector('meta[name="description"]')?.getAttribute("content"), inLanguage: lang, isPartOf: { "@id": `${BASE}#website` }, about: org },
    ...services,
    ...(faq.length ? [{ "@type": "FAQPage", "@id": `${url}#faq`, inLanguage: lang, mainEntity: faq }] : []),
  ];
  return JSON.stringify({ "@context": "https://schema.org", "@graph": graph }, null, 1).replace(/</g, "\\u003c");
}

function headTags(root, lang, file, { alternates = true, jsonld = false, indexable = target.indexable } = {}) {
  const url = pageUrl(lang, file);
  const tags = [
    `<meta name="robots" content="${indexable ? "index, follow, max-image-preview:large" : "noindex, nofollow"}">`,
    `<link rel="canonical" href="${url}">`,
  ];
  if (alternates) {
    tags.push(`<link rel="alternate" hreflang="en" href="${pageUrl("en", file)}">`,
      `<link rel="alternate" hreflang="hi" href="${pageUrl("hi", file)}">`,
      `<link rel="alternate" hreflang="x-default" href="${pageUrl("en", file)}">`);
  }
  const title = root.querySelector('meta[property="og:title"]')?.getAttribute("content") || text(root.querySelector("title"));
  const desc = root.querySelector('meta[property="og:description"]')?.getAttribute("content") || root.querySelector('meta[name="description"]')?.getAttribute("content") || "";
  tags.push(
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:site_name" content="${BUSINESS.name}">`,
    `<meta property="og:locale" content="${lang === "hi" ? "hi_IN" : "en_IN"}">`,
    `<meta property="og:locale:alternate" content="${lang === "hi" ? "en_IN" : "hi_IN"}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${BASE}assets/og.jpg">`,
  );
  if (!root.querySelector('meta[property="og:title"]')) tags.push(`<meta property="og:title" content="${esc(title)}">`, `<meta property="og:description" content="${esc(desc)}">`, `<meta property="og:image" content="${BASE}assets/og.jpg">`, `<meta property="og:type" content="website">`);
  if (jsonld) tags.push(`<script type="application/ld+json">\n${structuredData(root, lang)}\n</script>`);
  // replace any robots meta already in the source
  root.querySelectorAll('meta[name="robots"]').forEach((m) => m.remove());
  root.querySelector('meta[property="og:image"]')?.setAttribute("content", `${BASE}assets/og.jpg`);
  const anchor = root.querySelector('meta[name="description"]') || root.querySelector("title");
  anchor.insertAdjacentHTML("afterend", "\n  " + tags.join("\n  "));
}

/* ---------- pages ---------- */
// pages that have a Hindi version: links to them from a Hindi page stay inside hi/
const LOCALIZED = ["", "./", "index.html", "privacy.html"];
const problems = [];
function page(file, lang, { reviewsBlock = false, alternates = true, jsonld = false, indexable } = {}) {
  let html = read(file);
  if (reviewsBlock) html = html.replace(/[ \t]*<!-- reviews:start[\s\S]*?<!-- reviews:end -->\n?/, reviewsHtml(lang));
  const doc = parseDocument(html);
  const { root } = doc;
  if (lang === "hi") {
    root.querySelector("html").setAttribute("lang", "hi");
    const missing = translate(root, dict);
    if (missing.length) problems.push(`${file} (hi): ${missing.length} strings without a translation, run "npm run check"`);
    rebaseUrls(root, "../", LOCALIZED);
    root.querySelector("meta[charset]").insertAdjacentHTML("afterend", '\n  <meta name="vs-root" content="../">');
    for (const a of root.querySelectorAll(".lang-switch")) {
      a.setAttribute("href", (a.getAttribute("href") || "").replace(/^(\.\.\/)?hi\//, "../") || "../");
      a.setAttribute("hreflang", "en");
      a.setAttribute("lang", "en");
      a.set_content(a.closest(".menu-foot") ? "Read this page in English" : "English");
    }
  }
  headTags(root, lang, file === "index.html" ? "" : file, { alternates, jsonld, indexable });
  const bad = brokenAnchors(root);
  if (bad.length) problems.push(`${file} (${lang}): links to missing sections #${bad.join(", #")}`);
  const out = path.join(DIST, lang === "hi" ? "hi" : "", file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, serialize(doc));
}

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
for (const f of STATIC) {
  const from = path.join(SRC, f);
  if (fs.existsSync(from)) fs.cpSync(from, path.join(DIST, f), { recursive: true });
}

for (const lang of ["en", "hi"]) {
  page("index.html", lang, { reviewsBlock: true, jsonld: true });
  page("privacy.html", lang);
}
// The 404 page is served at any missing address, so its links are made absolute
{
  const doc = parseDocument(read("404.html"));
  const sitePath = new URL(BASE).pathname;
  doc.root.querySelector("head").insertAdjacentHTML("afterbegin", `\n  <base href="${sitePath}">`);
  fs.writeFileSync(path.join(DIST, "404.html"), serialize(doc));
}

/* ---------- robots, sitemap, llms.txt ---------- */
fs.writeFileSync(path.join(DIST, "robots.txt"), target.indexable
  ? `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${BASE}sitemap.xml\n`
  : `# Preview copy: the live site is https://www.vyanasoul.com/\nUser-agent: *\nDisallow: /\n`);

const sitemapEntry = (file, priority) => ["en", "hi"].map((lang) => `  <url>
    <loc>${pageUrl(lang, file)}</loc>
    <lastmod>${today}</lastmod>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${pageUrl("en", file)}"/>
    <xhtml:link rel="alternate" hreflang="hi" href="${pageUrl("hi", file)}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl("en", file)}"/>
  </url>`).join("\n");
fs.writeFileSync(path.join(DIST, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntry("", "1.0")}
${sitemapEntry("privacy.html", "0.2")}
</urlset>
`);

{
  const { root } = parseDocument(read("index.html"));
  const sessions = root.querySelectorAll(".session-card").map((c) => `- ${text(c.querySelector("h3"))}: ${text(c.querySelector(".sc-main p"))}`).join("\n");
  const faq = root.querySelectorAll(".faq-list details").map((d) => {
    const q = d.querySelector("summary").clone(); q.querySelectorAll(".faq-icon").forEach((i) => i.remove());
    return `### ${text(q)}\n${text(d.querySelector(".faq-a"))}`;
  }).join("\n\n");
  fs.writeFileSync(path.join(DIST, "llms.txt"), `# ${BUSINESS.name}

> ${BUSINESS.person} gives one-to-one Akashic Records readings, Lama Fera healing and Pranic Healing sessions online by video call, in English and Hindi, from ${BUSINESS.city}. More than 600 sessions with clients in India and abroad.

## Sessions
${sessions}

## Booking
- Request a session: ${BASE}#book (Rekha confirms within 24 hours on WhatsApp or by email)
- WhatsApp: https://wa.me/${BUSINESS.whatsapp}
- Email: ${BUSINESS.email}

## Pages
- [Home (English)](${BASE})
- [Home (Hindi)](${BASE}hi/)
- [Privacy notice](${BASE}privacy.html)

## Questions
${faq}

Readings and healing sessions offer spiritual guidance. They are not a substitute for medical, psychological, legal or financial advice.
`);
}

const count = (dir) => fs.readdirSync(dir, { recursive: true }).length;
console.log(`Built ${targetName} (${BASE}) into dist/: ${count(DIST)} files, ${reviews.length} reviews, ${target.indexable ? "indexable" : "noindex"}`);
if (problems.length) {
  console.warn("\nNeeds attention:\n- " + problems.join("\n- "));
  if (targetName === "production") process.exit(1);
}
