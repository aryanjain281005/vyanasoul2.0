/* Vyana Soul admin: booking requests, contact messages, reviews and the website's text.
   Access is enforced by the database (row-level security, is_admin()), not by this page:
   a non-admin who signs in simply gets no rows. Bundled to admin/admin.js with `npm run build:admin`. */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://xvdoutqezjsuogankqna.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_H2PXLN9Ms30bXwxnyDz8RA_P-xIVIDO";
const FN = `${SUPABASE_URL}/functions/v1/booking`;
const sb = createClient(SUPABASE_URL, PUBLISHABLE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } });

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
/** Small element builder; text is always set as text, never as HTML. */
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
const icon = (id) => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "ic"); s.setAttribute("aria-hidden", "true"); const u = document.createElementNS("http://www.w3.org/2000/svg", "use"); u.setAttribute("href", `#${id}`); s.append(u); return s; };
const show = (el, on) => { el.hidden = !on; };

const SERVICE = { "personal-reading": "Akashic Records reading", "lama-fera": "Lama Fera healing", "pranic-healing": "Pranic Healing", "not-sure": "Not sure yet" };
const STATUS = [["new", "New"], ["in-progress", "In progress"], ["completed", "Completed"], ["cancelled", "Cancelled"]];
const MSG_STATUS = [["new", "New"], ["read", "Read"], ["replied", "Replied"]];
const LANG = { en: "English", hi: "Hindi" };

function ago(iso) {
  const d = new Date(iso), s = (Date.now() - d) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
const niceDate = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
// WhatsApp needs the full international number; numbers typed without a code are Indian
function waDigits(phone) {
  const d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d.startsWith("0")) return "91" + d.slice(1);
  return d;
}
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "";

/* ---------------- auth ---------------- */
let session = null;
// ?next=: the page to return to after signing in (edit mode). Kept for the trip through Google or an email link.
try { const n = new URLSearchParams(location.search).get("next"); if (n) sessionStorage.setItem("vs-next", n); } catch (e) {}

async function route() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  show($("#loading"), false);
  show($("#who"), !!session);
  show($("#sign-out"), !!session);
  if (!session) { show($("#signin"), true); show($("#app"), false); show($("#denied"), false); return; }
  $("#who").textContent = session.user.email;
  const { data: profile } = await sb.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  if (profile?.role !== "admin") {
    try { localStorage.removeItem("vs-admin"); } catch (e) {}
    $("#denied-email").textContent = session.user.email;
    show($("#denied"), true); show($("#signin"), false); show($("#app"), false);
    return;
  }
  show($("#signin"), false); show($("#denied"), false); show($("#app"), true);
  // the website shows "Edit this page" to admins signed in on this device
  try { localStorage.setItem("vs-admin", "1"); } catch (e) {}
  // back to the page that sent them here to sign in (edit mode)
  let next = null;
  try { next = sessionStorage.getItem("vs-next"); sessionStorage.removeItem("vs-next"); } catch (e) {}
  if (next && /^\/(?!\/)[^\s]*\?edit$/.test(next)) { location.replace(next); return; }
  loadRequests();
  loadMessages();
  loadReviews();
  loadTexts();
}

$("#signin-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#si-email").value.trim(), password = $("#si-pass").value;
  const err = $("#si-error"), ok = $("#si-ok"), btn = $("#si-submit");
  show(err, false); show(ok, false);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = "Enter the email address of your admin account."; show(err, true); $("#si-email").focus(); return; }
  btn.classList.add("is-loading"); btn.setAttribute("aria-disabled", "true");
  try {
    if (password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? "That email and password don't match. Try again, or leave the password empty to get a sign-in link by email." : error.message);
      await route();
    } else {
      const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split("#")[0].split("?")[0], shouldCreateUser: false } });
      if (error) throw new Error(/not allowed|signups/i.test(error.message) ? "There's no admin account with that email." : error.message);
      ok.textContent = `We've sent a sign-in link to ${email}. Open it on this device.`;
      show(ok, true);
    }
  } catch (x) {
    err.textContent = x.message || "Sign-in didn't work. Try again.";
    show(err, true);
  } finally {
    btn.classList.remove("is-loading"); btn.removeAttribute("aria-disabled");
  }
});
$("#si-google").addEventListener("click", () => sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.href.split("#")[0].split("?")[0] } }));
$("#sign-out").addEventListener("click", async () => {
  try { localStorage.removeItem("vs-admin"); } catch (e) {}
  await sb.auth.signOut();
  location.reload();
});
sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" || event === "SIGNED_OUT") route(); });

/* ---------------- tabs ---------------- */
const tabs = ["requests", "messages", "reviews", "text"];
function selectTab(name, focus = false) {
  tabs.forEach((t) => {
    const on = t === name;
    $(`#tab-${t}`).setAttribute("aria-selected", String(on));
    $(`#tab-${t}`).tabIndex = on ? 0 : -1;
    show($(`#panel-${t}`), on);
    if (on && focus) $(`#tab-${t}`).focus();
  });
}
tabs.forEach((t, i) => {
  const tab = $(`#tab-${t}`);
  tab.addEventListener("click", () => selectTab(t));
  tab.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") selectTab(tabs[(i + 1) % tabs.length], true);
    if (e.key === "ArrowLeft") selectTab(tabs[(i + tabs.length - 1) % tabs.length], true);
  });
});
selectTab(location.hash === "#text" ? "text" : "requests");

async function callFunction(path, body) {
  const { data } = await sb.auth.getSession();
  const res = await fetch(`${FN}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

/* ---------------- requests ---------------- */
let requests = [], failedAlerts = new Map(), filter = "open", query = "";

async function loadRequests() {
  $("#req-status").textContent = "Loading requests…";
  const { data, error } = await sb.from("consultancy_requests")
    .select("*").order("created_at", { ascending: false }).limit(500);
  if (error) { $("#req-status").textContent = `Couldn't load requests: ${error.message}`; return; }
  requests = data;
  failedAlerts = new Map();
  // alerts that never reached Telegram or email (the table exists once the v2 migration has run)
  const ids = requests.slice(0, 200).map((r) => r.id);
  if (ids.length) {
    const { data: log } = await sb.from("notification_log").select("request_id, channel, last_error").eq("status", "failed").in("request_id", ids);
    for (const l of log || []) failedAlerts.set(l.request_id, [...(failedAlerts.get(l.request_id) || []), l]);
  }
  const fresh = requests.filter((r) => r.status === "new").length;
  $("#count-new").textContent = fresh ? String(fresh) : "";
  renderRequests();
}

function renderRequests() {
  const q = query.toLowerCase();
  const list = requests.filter((r) => {
    if (filter === "open" && !(r.status === "new" || r.status === "in-progress")) return false;
    if (!["open", "all"].includes(filter) && r.status !== filter) return false;
    if (!q) return true;
    return [r.full_name, r.phone, r.email, r.ref, r.message, r.country].some((v) => (v || "").toLowerCase().includes(q));
  });
  $("#req-status").textContent = `${list.length} ${list.length === 1 ? "request" : "requests"}`;
  $("#req-list").replaceChildren(...(list.length ? list.map(requestCard) : [h("li", { class: "a-empty" }, "Nothing here. New requests appear at the top as they arrive.")]));
}

function requestCard(r) {
  const wa = waDigits(r.phone);
  const failed = failedAlerts.get(r.id) || [];
  const status = h("select", { id: `st-${r.id}` }, STATUS.map(([v, l]) => h("option", { value: v, selected: r.status === v }, l)));
  const notes = h("textarea", { id: `nt-${r.id}`, rows: 2 }, r.admin_notes || "");
  const saved = h("span", { class: "a-hint", role: "status" });
  const save = h("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: async () => {
    save.classList.add("is-loading");
    const { error } = await sb.from("consultancy_requests").update({ status: status.value, admin_notes: notes.value }).eq("id", r.id);
    save.classList.remove("is-loading");
    if (error) { saved.textContent = `Not saved: ${error.message}`; return; }
    r.status = status.value; r.admin_notes = notes.value;
    saved.textContent = "Saved";
    $("#count-new").textContent = String(requests.filter((x) => x.status === "new").length || "");
    setTimeout(() => { saved.textContent = ""; }, 2500);
  } }, "Save");
  const day = r.preferred_date ? niceDate(r.preferred_date) : r.preferred_day;
  const msg = `Namaste ${firstName(r.full_name)} ji, this is Rekha from Vyana Soul about your session request${r.ref ? ` ${r.ref}` : ""}.`;

  return h("li", { class: `a-card${r.status === "new" ? " is-new" : ""}` },
    h("div", { class: "a-card-head" },
      h("span", { class: "a-name" }, r.full_name || "No name"),
      r.ref ? h("span", { class: "a-ref" }, r.ref) : null,
      h("time", { class: "a-when", datetime: r.created_at, title: new Date(r.created_at).toLocaleString("en-IN") }, ago(r.created_at)),
    ),
    failed.length ? h("p", { class: "a-alert" }, icon("i-alert"),
      `The ${failed.map((f) => f.channel === "telegram" ? "Telegram alert" : f.channel === "owner_email" ? "email to you" : "confirmation email to the client").join(" and ")} didn't go through.`,
      h("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: async (e) => {
        const b = e.currentTarget; b.classList.add("is-loading");
        const { status: st, body } = await callFunction("resend", { id: r.id });
        b.classList.remove("is-loading");
        const still = (body.log || []).filter((l) => l.status === "failed");
        if (st === 200 && !still.length) { failedAlerts.delete(r.id); renderRequests(); }
        else b.replaceWith(h("span", {}, st === 200 ? `Still failing: ${still[0].last_error}` : "Couldn't resend. Try again later."));
      } }, "Send again")) : null,
    h("dl", { class: "a-facts" },
      h("dt", {}, "Session"), h("dd", {}, SERVICE[r.service] || r.service || "Not given"),
      day ? [h("dt", {}, "Day"), h("dd", {}, day)] : null,
      r.preferred_time ? [h("dt", {}, "Time"), h("dd", {}, r.preferred_time)] : null,
      r.country ? [h("dt", {}, "Lives in"), h("dd", {}, r.country + (r.timezone ? ` (${r.timezone})` : ""))] : null,
      r.session_language ? [h("dt", {}, "Language"), h("dd", {}, LANG[r.session_language] || r.session_language)] : null,
      r.phone ? [h("dt", {}, "Phone"), h("dd", {}, r.phone)] : null,
      r.email ? [h("dt", {}, "Email"), h("dd", {}, r.email)] : null,
    ),
    r.message ? h("p", { class: "a-msg" }, r.message) : null,
    h("div", { class: "a-contact" },
      wa ? h("a", { class: "btn btn-primary btn-sm", href: `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, target: "_blank", rel: "noopener" }, icon("i-chat"), "WhatsApp") : null,
      r.phone ? h("a", { class: "btn btn-secondary btn-sm", href: `tel:${r.phone.replace(/[^\d+]/g, "")}` }, icon("i-phone"), "Call") : null,
      r.email ? h("a", { class: "btn btn-secondary btn-sm", href: `mailto:${r.email}?subject=${encodeURIComponent(`Your Vyana Soul session request${r.ref ? ` (${r.ref})` : ""}`)}&body=${encodeURIComponent(msg + "\n\n")}` }, icon("i-mail"), "Email") : null,
    ),
    h("div", { class: "a-manage" },
      h("div", { class: "a-manage-row" },
        h("div", { class: "a-field" }, h("label", { for: `st-${r.id}` }, "Status"), status),
        h("div", { class: "a-field" }, h("label", { for: `nt-${r.id}` }, "Private notes"), notes),
      ),
      h("div", { class: "a-actions" }, save, saved),
    ),
  );
}

$$(".a-chip").forEach((c) => c.addEventListener("click", () => {
  filter = c.dataset.status;
  $$(".a-chip").forEach((x) => x.setAttribute("aria-pressed", String(x === c)));
  renderRequests();
}));
let searchT;
$("#req-search").addEventListener("input", (e) => { clearTimeout(searchT); searchT = setTimeout(() => { query = e.target.value.trim(); renderRequests(); }, 150); });
$("#refresh").addEventListener("click", () => { loadRequests(); loadMessages(); });
// fresh data when Rekha comes back to the tab
document.addEventListener("visibilitychange", () => { if (!document.hidden && session && !$("#app").hidden) loadRequests(); });

/* ---------------- contact messages ---------------- */
async function loadMessages() {
  const { data, error } = await sb.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  if (error) { $("#msg-status").textContent = `Couldn't load messages: ${error.message}`; return; }
  const fresh = data.filter((m) => m.status === "new").length;
  $("#count-msg").textContent = fresh ? String(fresh) : "";
  $("#msg-list").replaceChildren(...(data.length ? data.map((m) => {
    const st = h("select", { "aria-label": `Status of the message from ${m.name}` }, MSG_STATUS.map(([v, l]) => h("option", { value: v, selected: m.status === v }, l)));
    st.addEventListener("change", async () => {
      await sb.from("contact_messages").update({ status: st.value }).eq("id", m.id);
      m.status = st.value;
      $("#count-msg").textContent = String(data.filter((x) => x.status === "new").length || "");
    });
    return h("li", { class: `a-card${m.status === "new" ? " is-new" : ""}` },
      h("div", { class: "a-card-head" }, h("span", { class: "a-name" }, m.name), h("time", { class: "a-when", datetime: m.created_at }, ago(m.created_at))),
      h("dl", { class: "a-facts" }, h("dt", {}, "Email"), h("dd", {}, m.email), h("dt", {}, "Subject"), h("dd", {}, m.subject)),
      h("p", { class: "a-msg" }, m.message),
      h("div", { class: "a-contact" },
        h("a", { class: "btn btn-secondary btn-sm", href: `mailto:${m.email}?subject=${encodeURIComponent("Re: " + m.subject)}` }, icon("i-mail"), "Reply by email"),
        st),
    );
  }) : [h("li", { class: "a-empty" }, "No messages.")]));
}

/* ---------------- reviews ---------------- */
let reviews = [], editing = null;
async function loadReviews() {
  const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) { $("#rv-status").textContent = `Couldn't load reviews: ${error.message}`; return; }
  reviews = data.sort((a, b) => (Number(!!b.featured) - Number(!!a.featured)) || ((a.sort_order ?? 0) - (b.sort_order ?? 0)));
  const shown = reviews.filter((r) => r.published !== false).length;
  $("#rv-status").textContent = `${reviews.length} reviews, ${shown} shown on the website`;
  $("#rv-list").replaceChildren(...reviews.map((r) => h("li", { class: "a-card" },
    h("div", { class: "a-card-head" },
      h("span", { class: "a-name" }, (r.name || "").trim()),
      r.location ? h("span", { class: "a-hint" }, r.location.trim()) : null,
      h("button", { type: "button", class: "btn btn-secondary btn-sm", style: "margin-left:auto", onclick: () => openReview(r) }, "Edit"),
    ),
    h("div", { class: "a-badges" },
      h("span", { class: `a-badge${r.published !== false ? " on" : ""}` }, r.published !== false ? "Shown" : "Hidden"),
      r.featured ? h("span", { class: "a-badge on" }, "Featured") : null,
      "consent_obtained" in r ? h("span", { class: `a-badge${r.consent_obtained ? " on" : " warn"}` }, r.consent_obtained ? "Client agreed" : "Consent not recorded") : null,
      r.service ? h("span", { class: "a-badge" }, r.service.trim()) : null,
    ),
    h("p", { class: "a-review-text", lang: r.language === "hi" ? "hi" : null }, r.review),
  )));
}

const dlg = $("#rv-dialog");
function openReview(r = null) {
  editing = r;
  $("#rv-dialog-h").textContent = r ? "Edit review" : "Add a review";
  $("#rv-name").value = (r?.name || "").trim();
  $("#rv-location").value = (r?.location || "").trim();
  const svc = (r?.service || "").trim();
  $("#rv-service").value = /^ak/i.test(svc) ? "Akashic reading" : [...$("#rv-service").options].some((o) => o.value === svc) ? svc : (r ? "" : "Akashic reading");
  $("#rv-language").value = r?.language || "en";
  $("#rv-short").value = r?.review || "";
  $("#rv-full").value = r?.full_review && r.full_review !== r.review ? r.full_review : "";
  $("#rv-consent").checked = !!r?.consent_obtained;
  $("#rv-published").checked = r ? r.published !== false : true;
  $("#rv-featured").checked = !!r?.featured;
  show($("#rv-delete"), !!r);
  show($("#rv-error"), false);
  dlg.showModal();
  $("#rv-name").focus();
}
$("#rv-add").addEventListener("click", () => openReview(null));
$("#rv-cancel").addEventListener("click", () => dlg.close());
$("#rv-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const err = $("#rv-error");
  const name = $("#rv-name").value.trim(), short = $("#rv-short").value.trim();
  if (!name || !short) { err.textContent = "Add the name and the short version of the review."; show(err, true); (name ? $("#rv-short") : $("#rv-name")).focus(); return; }
  if ($("#rv-published").checked && !$("#rv-consent").checked) {
    if (!confirm("You haven't ticked that the client agreed. Show this review on the website anyway?")) return;
  }
  const row = {
    name, location: $("#rv-location").value.trim(), service: $("#rv-service").value, language: $("#rv-language").value,
    review: short, full_review: $("#rv-full").value.trim() || short, rating: editing?.rating || 5,
    consent_obtained: $("#rv-consent").checked, published: $("#rv-published").checked, featured: $("#rv-featured").checked,
  };
  const q = editing ? sb.from("reviews").update(row).eq("id", editing.id) : sb.from("reviews").insert(row);
  const { error } = await q;
  if (error) { err.textContent = `Not saved: ${error.message}`; show(err, true); return; }
  dlg.close();
  loadReviews();
});
$("#rv-delete").addEventListener("click", async () => {
  if (!editing || !confirm(`Delete the review from ${editing.name.trim()}? This can't be undone.`)) return;
  const { error } = await sb.from("reviews").delete().eq("id", editing.id);
  if (error) { $("#rv-error").textContent = `Not deleted: ${error.message}`; show($("#rv-error"), true); return; }
  dlg.close();
  loadReviews();
});
async function updateWebsite(button, statusEl) {
  button.classList.add("is-loading");
  const { status } = await callFunction("rebuild");
  button.classList.remove("is-loading");
  statusEl.textContent = status === 202 ? "The website is updating. Changes appear in about a minute."
    : status === 501 ? "Automatic updates aren't switched on yet. Ask the developer to publish the site."
    : "The update didn't start. Try again in a minute.";
}
$("#rv-publish").addEventListener("click", (e) => updateWebsite(e.currentTarget, $("#rv-status")));

/* ---------------- website text ----------------
   texts.json (written by the build) lists every text on the site: the original, what the
   published site shows, where it is and what it is. site_text holds the edits; the build
   puts them in place of the originals. A null in a language keeps that language's original. */
let texts = [], saved = new Map(), draft = new Map();
let txLang = "en", txQuery = "", txOnlyChanged = false;
const opened = new Set();

const original = (t, lang) => (lang === "en" || !t.x ? t.en : t.hi ?? t.en);
const savedValue = (t, lang) => saved.get(t.k)?.[lang] ?? null;
function current(t, lang) {
  if (lang === "hi" && !t.x) return current(t, "en"); // prices and numbers follow the English page
  const d = draft.get(t.k);
  if (d && lang in d) return d[lang] ?? original(t, lang);
  return savedValue(t, lang) ?? original(t, lang);
}
const published = (t, lang) => (lang === "en" ? t.be : t.bh ?? t.be);
const tidy = (v) => v.replace(/\s+/g, " ").trim();
const unpublished = () => texts.filter((t) => ["en", "hi"].some((l) => current(t, l) !== published(t, l))).length;

async function loadTexts() {
  $("#tx-status").textContent = "Loading the website's text…";
  const [list, db] = await Promise.all([
    fetch("texts.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    sb.from("site_text").select("*"),
  ]);
  if (!list) { $("#tx-status").textContent = "The list of the website's text is missing. Ask the developer to rebuild the site."; return; }
  if (db.error) { $("#tx-status").textContent = `Couldn't load the saved text: ${db.error.message}`; return; }
  texts = list.texts;
  saved = new Map(db.data.map((r) => [r.key, r]));
  renderTexts();
}

function textItem(t) {
  const lang = txLang;
  const orig = original(t, lang);
  const area = h("textarea", { id: `tx-${texts.indexOf(t)}`, rows: Math.min(6, Math.ceil(orig.length / 70)), lang: lang === "hi" ? "hi" : null, maxlength: 4000 });
  area.value = current(t, lang);
  const warn = h("p", { class: "tx-warn", role: "alert", hidden: true });
  const origLine = h("p", { class: "tx-orig" }, "Original: ", h("span", { lang: lang === "hi" ? "hi" : null }, `“${orig}”`));
  const undo = h("button", { type: "button", class: "btn-text" }, "Undo change");
  const foot = h("div", { class: "tx-foot" }, origLine, undo);
  const badge = h("span", { class: "a-badge on" }, "Changed");
  const row = saved.get(t.k);
  const item = h("li", { class: "tx-item" },
    h("div", { class: "tx-meta" },
      h("label", { class: "tx-kind", for: area.id }, t.t),
      t.n ? h("span", {}, `appears ${t.n} times; changing it changes all of them`) : null,
      t.p === "privacy.html" ? h("span", {}, "privacy page") : null,
      badge,
      row?.updated_at ? h("span", {}, `saved ${ago(row.updated_at)}`) : null),
    t.c ? h("p", { class: "tx-context" }, `Part of: “${t.c}”`) : null,
    lang === "hi" ? h("p", { class: "tx-ref", lang: "en" }, `English: “${current(t, "en")}”`) : null,
    area, warn, foot);
  // the English was edited after the Hindi: the translation may no longer match
  if (lang === "hi" && row?.en_updated_at && (!row.hi_updated_at || row.en_updated_at > row.hi_updated_at)) {
    item.insertBefore(h("p", { class: "tx-warn soft" }, `The English was changed ${ago(row.en_updated_at)}. Check this Hindi still says the same.`), area);
  }
  const sync = () => {
    const v = tidy(area.value);
    const changed = v !== orig;
    show(foot, changed); show(badge, changed);
    item.classList.toggle("is-changed", changed);
    item.classList.toggle("is-dirty", (draft.get(t.k) || {})[lang] !== undefined);
    if (!v) { warn.textContent = "Write something here, or press Undo change to go back to the original."; warn.className = "tx-warn"; show(warn, true); }
    else if (v.length > orig.length * 1.6 + 25) { warn.textContent = "Much longer than before. Check how it looks on a phone with Preview on the page."; warn.className = "tx-warn soft"; show(warn, true); }
    else show(warn, false);
  };
  area.addEventListener("input", () => {
    const v = tidy(area.value);
    const d = { ...(draft.get(t.k) || {}) };
    const before = savedValue(t, lang) ?? orig;
    if (v === before) delete d[lang]; else d[lang] = v === orig ? null : v;
    if (Object.keys(d).length) draft.set(t.k, d); else draft.delete(t.k);
    sync(); updateSaveBar();
  });
  undo.addEventListener("click", () => { area.value = orig; area.dispatchEvent(new Event("input")); area.focus(); });
  sync();
  return item;
}

function renderTexts() {
  const q = txQuery.toLowerCase();
  const list = texts.filter((t) => {
    if (txLang === "hi" && !t.x) return false;
    if (txOnlyChanged && current(t, txLang) === original(t, txLang)) return false;
    if (!q) return true;
    return [t.k, t.s, t.t, t.c, current(t, txLang), txLang === "hi" ? current(t, "en") : ""].some((v) => (v || "").toLowerCase().includes(q));
  });
  const groups = new Map();
  for (const t of list) groups.set(t.s, [...(groups.get(t.s) || []), t]);
  const parts = [...groups].map(([name, items]) => {
    const changed = items.filter((t) => current(t, txLang) !== original(t, txLang)).length;
    const d = h("details", { class: "tx-group", open: !!q || txOnlyChanged || opened.has(name) },
      h("summary", {}, h("span", {}, name), h("span", { class: "a-hint" }, `${items.length} ${items.length === 1 ? "text" : "texts"}`),
        changed ? h("span", { class: "a-badge on" }, `${changed} changed`) : null));
    let filled = false;
    const fill = () => { if (filled) return; filled = true; d.append(h("ol", { class: "tx-items" }, items.map(textItem))); };
    if (d.open) fill();
    d.addEventListener("toggle", () => { if (d.open) { fill(); opened.add(name); } else opened.delete(name); });
    return d;
  });
  // edits whose text is no longer on the site (the page was changed since)
  const known = new Set(texts.map((t) => t.k));
  const orphans = [...saved.values()].filter((r) => !known.has(r.key) && !r.key.startsWith("img:")); // photos are edited on the page
  if (orphans.length && !q) {
    parts.push(h("details", { class: "tx-group" },
      h("summary", {}, h("span", {}, "No longer on the site"), h("span", { class: "a-hint" }, `${orphans.length} old ${orphans.length === 1 ? "edit" : "edits"}`)),
      h("ol", { class: "tx-items" }, orphans.map((r) => h("li", { class: "tx-item" },
        h("p", { class: "tx-orig" }, `Was: “${r.key}”`),
        h("p", { class: "tx-ref" }, `Changed to: “${r.en || r.hi}”`),
        h("div", { class: "tx-foot" }, h("button", { type: "button", class: "btn btn-secondary btn-sm", onclick: async () => {
          const { error } = await sb.from("site_text").delete().eq("key", r.key);
          if (!error) { saved.delete(r.key); renderTexts(); }
        } }, "Remove this old edit")))))));
  }
  const pending = unpublished();
  $("#count-text").textContent = pending ? String(pending) : "";
  $("#tx-status").textContent = (q ? `${list.length} ${list.length === 1 ? "text matches" : "texts match"} “${txQuery}”` : `${list.length} texts in ${groups.size} parts of the ${txLang === "hi" ? "Hindi" : "English"} page`)
    + (pending ? `. ${pending} saved ${pending === 1 ? "change isn't" : "changes aren't"} on the website yet: press Update the website.` : ".");
  $("#tx-list").replaceChildren(...(parts.length ? parts : [h("p", { class: "a-empty" }, txOnlyChanged ? "You haven't changed any text yet." : "No text matches. Try a shorter word.")]));
}

function updateSaveBar() {
  const n = [...draft.values()].reduce((sum, d) => sum + Object.keys(d).length, 0);
  show($("#tx-savebar"), n > 0);
  $("#app").classList.toggle("has-savebar", n > 0);
  $("#tx-dirty").textContent = `${n} unsaved ${n === 1 ? "change" : "changes"}`;
}

async function saveTexts() {
  const btn = $("#tx-save");
  const byKey = new Map(texts.map((t) => [t.k, t]));
  const upserts = [], removals = [];
  for (const [key, d] of draft) {
    const t = byKey.get(key);
    const next = { key, en: "en" in d ? d.en : savedValue(t, "en"), hi: "hi" in d ? d.hi : savedValue(t, "hi") };
    if (next.en === "" || next.hi === "") { $("#tx-dirty").textContent = "Some text is empty. Write something, or press Undo change."; return; }
    if (next.en == null && next.hi == null) { if (saved.has(key)) removals.push(key); } else upserts.push(next);
  }
  btn.classList.add("is-loading");
  const results = await Promise.all([
    upserts.length ? sb.from("site_text").upsert(upserts, { onConflict: "key" }) : { error: null },
    removals.length ? sb.from("site_text").delete().in("key", removals) : { error: null },
  ]);
  btn.classList.remove("is-loading");
  const error = results.find((r) => r.error)?.error;
  if (error) { $("#tx-dirty").textContent = `Not saved: ${error.message}`; return; }
  draft.clear();
  updateSaveBar();
  await loadTexts();
  $("#tx-status").textContent = "Saved. Press Preview on the page to see it, then Update the website to show it to everyone.";
}

function previewTexts() {
  // what changes against the published site, saved or not, for each page language
  const pages = {};
  for (const lang of ["en", "hi"]) {
    const page = { text: [], js: {} };
    for (const t of texts) {
      const from = published(t, lang), to = current(t, lang);
      if (to === from || from == null) continue;
      const m = t.k.match(/^js:(\w+)\.(\w+)$/);
      if (m) (page.js[m[1]] ||= {})[m[2]] = to;
      else page.text.push([from, to]);
    }
    pages[lang] = page;
  }
  try { localStorage.setItem("vs-text-preview", JSON.stringify({ at: Date.now(), pages })); }
  catch (e) { $("#tx-status").textContent = "This browser won't keep the preview. Try another browser, or save and update the website."; return; }
  window.open(`../${txLang === "hi" ? "hi/" : ""}?preview-text`, "vs-preview");
}

function setTextLang(lang) {
  txLang = lang;
  $("#tx-en").setAttribute("aria-pressed", String(lang === "en"));
  $("#tx-hi").setAttribute("aria-pressed", String(lang === "hi"));
  renderTexts();
}
$("#tx-en").addEventListener("click", () => setTextLang("en"));
$("#tx-hi").addEventListener("click", () => setTextLang("hi"));
let txT;
$("#tx-search").addEventListener("input", (e) => { clearTimeout(txT); txT = setTimeout(() => { txQuery = e.target.value.trim(); renderTexts(); }, 200); });
$("#tx-changed").addEventListener("change", (e) => { txOnlyChanged = e.target.checked; renderTexts(); });
$("#tx-save").addEventListener("click", saveTexts);
$("#tx-discard").addEventListener("click", () => {
  if (!confirm("Throw away the changes you haven't saved?")) return;
  draft.clear(); updateSaveBar(); renderTexts();
});
$("#tx-preview").addEventListener("click", previewTexts);
$("#tx-publish").addEventListener("click", (e) => {
  if (draft.size && !confirm("Some changes aren't saved yet, so they won't be on the website. Update the website anyway?")) return;
  updateWebsite(e.currentTarget, $("#tx-status"));
});
addEventListener("beforeunload", (e) => { if (draft.size) { e.preventDefault(); e.returnValue = ""; } });

route();
