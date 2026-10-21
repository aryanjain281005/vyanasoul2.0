/* Vyana Soul admin: booking requests, contact messages and reviews.
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
    $("#denied-email").textContent = session.user.email;
    show($("#denied"), true); show($("#signin"), false); show($("#app"), false);
    return;
  }
  show($("#signin"), false); show($("#denied"), false); show($("#app"), true);
  loadRequests();
  loadMessages();
  loadReviews();
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
$("#sign-out").addEventListener("click", async () => { await sb.auth.signOut(); location.reload(); });
sb.auth.onAuthStateChange((event) => { if (event === "SIGNED_IN" || event === "SIGNED_OUT") route(); });

/* ---------------- tabs ---------------- */
const tabs = ["requests", "messages", "reviews"];
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
selectTab("requests");

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
$("#rv-publish").addEventListener("click", async (e) => {
  const b = e.currentTarget; b.classList.add("is-loading");
  const { status } = await callFunction("rebuild");
  b.classList.remove("is-loading");
  $("#rv-status").textContent = status === 202 ? "The website is updating. Changes appear in about a minute."
    : status === 501 ? "Automatic updates aren't switched on yet. Ask the developer to publish the site."
    : "The update didn't start. Try again in a minute.";
});

route();
