/* Publishing, shared by edit mode (edit-src/edit.js) and the admin (admin-src/admin.js), so both
   tell the same story about what's live.

   What's live is whatever the last build wrote into admin/texts.json (builtAt, and the built
   value of every text and photo). What's saved is in Supabase. A change is "not live yet" when
   the two differ. Publish asks the booking function to rebuild; the build is done when
   texts.json has a new builtAt. A publish in progress is kept in localStorage, so a reload
   picks the progress up again. */

const REPO = "aryanjain281005/vyanasoul2.0";
const KEY = "vs-publish";

/* ---------- what's saved but not live ---------- */
const original = (t, lang) => (lang === "en" || !t.x ? t.en : t.hi ?? t.en);
export function savedText(t, lang, saved) {
  if (lang === "hi" && !t.x) return savedText(t, "en", saved); // prices and numbers: one value
  return saved.get(t.k)?.[lang] ?? original(t, lang);
}
export const liveText = (t, lang) => (lang === "en" ? t.be : t.bh ?? t.be);
const photoRow = (k, saved) => { try { return JSON.parse(saved.get(`img:${k}`)?.en || "null"); } catch (e) { return null; } };
const galleryRow = (saved) => { try { const g = JSON.parse(saved.get("gallery")?.en || "null"); return Array.isArray(g?.strips) ? g : null; } catch (e) { return null; } };
const galleryOriginal = (site) => ({ strips: (site.gallery?.original || []).map((row) => row.map((k) => ({ k }))) });

/** Every change saved since the last build: [{ kind: "text" | "photo" | "gallery" | "review", ... }]. */
export function pendingChanges(site, saved, reviews = []) {
  const out = [];
  for (const t of site.texts || []) for (const lang of ["en", "hi"]) {
    if (lang === "hi" && !t.x) continue;
    if (savedText(t, lang, saved) !== liveText(t, lang)) out.push({ kind: "text", t, lang });
  }
  for (const p of site.photos || []) {
    const s = photoRow(p.k, saved);
    const now = { src: s?.src || null, pos: s?.pos || p.pos }, live = { src: p.b?.src || null, pos: p.b?.pos || p.pos };
    if (now.src !== live.src || now.pos !== live.pos) out.push({ kind: "photo", k: p.k });
  }
  if (site.gallery?.original?.length) {
    const now = galleryRow(saved) || galleryOriginal(site), live = site.gallery.built || galleryOriginal(site);
    if (JSON.stringify(now) !== JSON.stringify(live)) out.push({ kind: "gallery" });
  }
  for (const r of reviews) if (site.builtAt && (r.updated_at || r.created_at) > site.builtAt) out.push({ kind: "review", r });
  return out;
}

/* ---------- time ---------- */
export function ago(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
export const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/* ---------- a publish in progress ---------- */
export function publishingState() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "null");
    return s && Date.now() - s.at < 15 * 60000 ? s : null;
  } catch (e) { return null; }
}
const remember = (s) => { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} };

/** Ask for a rebuild. Returns { ok, state, message }; state is what watchPublish needs. */
export async function startPublish(fnUrl, accessToken, since) {
  const res = await fetch(`${fnUrl}/rebuild`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken || ""}` },
    body: "{}",
  }).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  if (res?.status === 202) {
    const state = { at: Date.now(), since, target: body.target || "production" };
    remember(state);
    return { ok: true, state };
  }
  return {
    ok: false,
    message: res?.status === 501 ? "Publishing isn't switched on yet. Your changes are saved; ask the developer to publish."
      : res?.status === 403 ? "Your sign-in has run out. Sign in again in the admin, then press Publish."
      : "Publishing didn't start. Check the internet connection and try again.",
  };
}

/**
 * Follow a publish until the new build is live. onUpdate({ phase, elapsed, site? }) is called
 * every few seconds; phase is "queued" | "building" | "uploading" | "live" | "failed" | "slow".
 * Returns a function that stops watching.
 */
export function watchPublish(root, state, onUpdate) {
  let stopped = false, n = 0;
  const tick = async () => {
    if (stopped) return;
    const elapsed = (Date.now() - state.at) / 1000;
    const site = await fetch(`${root}admin/texts.json?t=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (stopped) return;
    if (site?.builtAt && site.builtAt !== state.since) { remember(null); onUpdate({ phase: "live", elapsed, site }); return; }
    let phase = elapsed < 45 ? "building" : "uploading";
    // the preview builds on GitHub, which says how the build is going (and whether it failed)
    if (state.target === "preview" && n++ % 2 === 0) {
      const runs = await fetch(`https://api.github.com/repos/${REPO}/actions/runs?branch=publish-preview&per_page=1`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const run = runs?.workflow_runs?.[0];
      if (run && Date.parse(run.created_at) >= state.at - 60000) {
        if (run.status === "completed" && run.conclusion !== "success") { remember(null); onUpdate({ phase: "failed", elapsed }); return; }
        phase = run.status === "completed" ? "uploading" : run.status === "in_progress" ? "building" : "queued";
      } else if (elapsed < 30) phase = "queued";
    }
    if (elapsed > 10 * 60) { remember(null); onUpdate({ phase: "slow", elapsed }); return; }
    onUpdate({ phase, elapsed });
    setTimeout(tick, 6000);
  };
  tick();
  return () => { stopped = true; };
}

export const STEPS = [
  ["saved", "Your changes are saved"],
  ["building", "Building the website"],
  ["uploading", "Putting it online"],
  ["live", "Live for every visitor"],
];
/** Which step is done, current or still to come, for a phase. */
export function stepStates(phase) {
  const at = { queued: 1, building: 1, uploading: 2, live: 4 }[phase] ?? 1;
  return STEPS.map(([id, label], i) => ({ id, label, state: i < at ? "done" : i === at ? "now" : "todo" }));
}
/** The live site's address, made unique so the browser can't show an old saved copy. */
export const liveUrl = (root, builtAt, lang = "en") => `${root}${lang === "hi" ? "hi/" : ""}?v=${Date.parse(builtAt) || Date.now()}`;
