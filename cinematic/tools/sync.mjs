// Pull published reviews from Supabase into data/reviews.json.
// The build renders that file into the page, so reviews are in the HTML for search engines
// and a build never depends on the network. Run before a production build:
//   npm run sync && npm run build:prod

import fs from "node:fs";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.mjs";

const out = new URL("../data/reviews.json", import.meta.url);

const res = await fetch(`${SUPABASE_URL}/rest/v1/reviews?select=*&order=created_at.desc`, {
  headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Accept: "application/json" },
});
if (!res.ok) {
  console.error(`Could not read reviews (${res.status}): ${await res.text()}`);
  console.error("data/reviews.json was left as it was.");
  process.exit(1);
}
const rows = await res.json();

// Tidy what people typed in the admin: stray spaces and spellings of the service name
const service = (s) => {
  const v = (s || "").trim();
  if (!v) return "";
  if (/^ak/i.test(v)) return "Akashic reading"; // Akashic, Akashtic, Akshatic...
  if (/lama|fera/i.test(v)) return "Lama Fera healing";
  if (/pranic/i.test(v)) return "Pranic Healing";
  return v.charAt(0).toUpperCase() + v.slice(1);
};
const titleCase = (s) => s.replace(/\b([a-z])/g, (m) => m.toUpperCase());

const reviews = rows
  .filter((r) => r.published !== false)
  .map((r) => ({
    id: r.id,
    name: (r.name || "").trim().replace(/\s+/g, " "),
    location: titleCase((r.location || "").trim().replace(/\s+/g, " ")),
    service: service(r.service),
    rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
    // the full text when there is one; the short one is what the admin shows in lists
    text: ((r.full_review || "").trim() || (r.review || "").trim()).replace(/\r\n/g, "\n"),
    short: (r.review || "").trim(),
    language: r.language || (/[ऀ-ॿ]/.test(r.review || "") ? "hi" : "en"),
    featured: !!r.featured,
    sortOrder: r.sort_order ?? 0,
    createdAt: r.created_at,
  }))
  .filter((r) => r.name && r.text)
  .sort((a, b) => (b.featured - a.featured) || (a.sortOrder - b.sortOrder) || (a.createdAt < b.createdAt ? 1 : -1));

// Until the launch migration adds them, keep the four reviews the site showed before they
// were in the database (data/reviews-seed.json), so a sync never drops them
const seed = JSON.parse(fs.readFileSync(new URL("../data/reviews-seed.json", import.meta.url), "utf8")).reviews;
const names = new Set(reviews.map((r) => r.name));
const missingSeed = seed.filter((r) => !names.has(r.name));
if (missingSeed.length) {
  reviews.unshift(...missingSeed);
  reviews.sort((a, b) => (b.featured - a.featured) || (a.sortOrder - b.sortOrder) || (a.createdAt < b.createdAt ? 1 : -1));
  console.log(`Kept ${missingSeed.length} reviews from data/reviews-seed.json (not in the database yet)`);
}

fs.writeFileSync(out, JSON.stringify({ syncedAt: new Date().toISOString(), reviews }, null, 2) + "\n");
console.log(`Saved ${reviews.length} published reviews (${reviews.filter((r) => r.featured).length} featured) to data/reviews.json`);
