// Checks before a build or a commit:
//  - every English string on the pages has a Hindi translation in i18n/hi.json
//  - no unused translations are left behind
//  - in-page links point at sections that exist, and images have alt text
// `node tools/check.mjs --missing` prints the untranslated strings as JSON, ready to fill in.

import fs from "node:fs";
import path from "node:path";
import { brokenAnchors, parseDocument, translate } from "./lib.mjs";

const SRC = path.resolve(new URL("..", import.meta.url).pathname);
const read = (f) => fs.readFileSync(path.join(SRC, f), "utf8");
const dict = JSON.parse(read("i18n/hi.json"));

const errors = [];
const missing = new Set();
const used = new Set();

for (const file of ["index.html", "privacy.html"]) {
  const { root } = parseDocument(read(file));
  translate(root, dict, used).forEach((m) => missing.add(m));
  const bad = brokenAnchors(root);
  if (bad.length) errors.push(`${file}: links to missing sections: #${bad.join(", #")}`);
  const noAlt = root.querySelectorAll("img").filter((i) => i.getAttribute("alt") == null).map((i) => i.getAttribute("src"));
  if (noAlt.length) errors.push(`${file}: images without alt text: ${noAlt.join(", ")}`);
}

// strings the build adds (review service labels) must be translated too
const { reviews } = JSON.parse(read("data/reviews.json"));
for (const s of new Set(reviews.map((r) => r.service).filter(Boolean))) {
  used.add(s);
  if (!Object.prototype.hasOwnProperty.call(dict, s)) missing.add(s);
}

if (process.argv.includes("--missing")) {
  console.log(JSON.stringify(Object.fromEntries([...missing].map((k) => [k, ""])), null, 2));
  process.exit(0);
}

const unused = Object.keys(dict).filter((k) => !used.has(k));
if (missing.size) errors.push(`${missing.size} strings have no Hindi translation in i18n/hi.json:\n    ${[...missing].join("\n    ")}`);
const empty = Object.entries(dict).filter(([, v]) => !String(v).trim()).map(([k]) => k);
if (empty.length) errors.push(`${empty.length} translations are empty:\n    ${empty.join("\n    ")}`);
if (unused.length) console.warn(`Unused translations (safe to delete):\n    ${unused.join("\n    ")}`);

if (errors.length) {
  console.error("✗ " + errors.join("\n✗ "));
  process.exit(1);
}
console.log(`✓ All ${used.size} strings translated, links and alt text OK`);
