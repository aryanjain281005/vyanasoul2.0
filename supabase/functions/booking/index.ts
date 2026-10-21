// Vyana Soul booking function.
//
//   POST /booking          a session request from the site (public; validated, rate-limited)
//   POST /booking/resend   re-send the alerts for one request   (admin JWT)
//   POST /booking/rebuild  trigger a production rebuild         (admin JWT)
//
// A request is saved before any alert is sent, and the visitor gets their reference straight
// away. Alerts run after the response; every attempt is logged in notification_log, and
// failed ones are retried on the next request or from the admin page.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.4";
import {
  clientEmail, makeRef, ownerEmail, type RequestRow, SERVICES, telegramText, timeWindow, validate, weekdayOf,
} from "./lib.ts";

const env = (k: string) => Deno.env.get(k) ?? "";
const SITE_URL = env("SITE_URL") || "https://www.vyanasoul.com";
const WHATSAPP = env("OWNER_WHATSAPP") || "919987487242";
const ALLOWED = env("ALLOWED_ORIGINS").split(",").map((s) => s.trim()).filter(Boolean);
const RATE_LIMIT = 5; // requests per IP per 10 minutes

const db: SupabaseClient = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => {
  const guarded = p.catch((e) => console.error("background task failed", e));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(guarded);
};

// ---------- HTTP helpers ----------
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const ok = ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    ...(ok ? { "Access-Control-Allow-Origin": origin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}
const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
}

async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret) return true; // not configured
  if (typeof token !== "string" || !token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const out = await res.json().catch(() => ({}));
  return out.success === true;
}

async function requireAdmin(req: Request): Promise<boolean> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  if (!data?.user) return false;
  const { data: profile } = await db.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  return profile?.role === "admin";
}

// ---------- notifications ----------
type Channel = "telegram" | "owner_email" | "client_email";
const SELECT_ROW = "id, ref, full_name, email, phone, service, preferred_time, preferred_date, message, country, timezone, session_language, locale, created_at";

async function sendTelegram(r: RequestRow, retry: boolean): Promise<"sent" | "skipped"> {
  const token = env("TELEGRAM_BOT_TOKEN"), chat = env("TELEGRAM_CHAT_ID");
  if (!token || !chat) return "skipped";
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chat, text: telegramText(r, retry), parse_mode: "HTML", disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Telegram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "sent";
}

async function sendEmail(to: string, subject: string, text: string, replyTo?: string): Promise<"sent" | "skipped"> {
  const key = env("RESEND_API_KEY"), from = env("EMAIL_FROM");
  if (!key || !from || !to) return "skipped";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return "sent";
}

async function deliver(r: RequestRow, channel: Channel, retry = false): Promise<void> {
  let status: "sent" | "skipped" | "failed";
  let error = "";
  try {
    if (channel === "telegram") status = await sendTelegram(r, retry);
    else if (channel === "owner_email") {
      const m = ownerEmail(r);
      status = await sendEmail(env("OWNER_EMAIL"), m.subject, m.text, r.email || undefined);
    } else {
      const m = clientEmail(r, SITE_URL, WHATSAPP);
      status = await sendEmail(r.email, m.subject, m.text, env("OWNER_EMAIL") || undefined);
    }
  } catch (e) {
    status = "failed";
    error = String(e instanceof Error ? e.message : e).slice(0, 500);
  }
  const { data: prev } = await db.from("notification_log").select("attempts").eq("request_id", r.id).eq("channel", channel).maybeSingle();
  await db.from("notification_log").upsert(
    { request_id: r.id, channel, status, last_error: error, attempts: (prev?.attempts ?? 0) + 1 },
    { onConflict: "request_id,channel" },
  );
  if (status === "failed") console.error(`alert ${channel} for ${r.ref} failed: ${error}`);
}

const notifyAll = (r: RequestRow, retry = false) =>
  Promise.all((["telegram", "owner_email", "client_email"] as Channel[]).map((c) => deliver(r, c, retry)));

/** Re-send alerts that failed in the last 48 hours (at most 5, at most 5 attempts each). */
async function retryFailed(): Promise<void> {
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { data: failed } = await db.from("notification_log")
    .select("request_id, channel").eq("status", "failed").lt("attempts", 5).gte("created_at", since)
    .lt("updated_at", new Date(Date.now() - 60 * 1000).toISOString())
    .order("updated_at").limit(5);
  for (const f of failed ?? []) {
    const { data: row } = await db.from("consultancy_requests").select(SELECT_ROW).eq("id", f.request_id).maybeSingle();
    if (row) await deliver(row as RequestRow, f.channel as Channel, true);
  }
}

// ---------- routes ----------
async function createRequest(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null);
  const v = validate(body);
  if (!v.ok) return json(req, 422, { error: "invalid", fields: v.errors });

  const ip = clientIp(req);
  if (!(await verifyTurnstile((body as Record<string, unknown>)?.turnstileToken, ip))) {
    return json(req, 403, { error: "challenge" });
  }
  // Pretend success to bots that fill the honeypot, and store nothing
  if (v.spam) return json(req, 201, { ref: makeRef() });

  const ipHash = ip ? await sha256(env("IP_SALT") + ip) : null;
  if (ipHash) {
    const { count } = await db.from("consultancy_requests").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());
    if ((count ?? 0) >= RATE_LIMIT) return json(req, 429, { error: "rate_limited" });
  }

  const b = v.value;
  const window = timeWindow(b.time, b.date, b.timezone);
  const row = {
    full_name: b.name,
    email: b.email,
    phone: b.phone,
    service: SERVICES[b.service][0],
    preferred_time: window.local ? `${window.ist} (${window.local})` : window.ist,
    preferred_date: b.date || null,
    preferred_day: b.date ? weekdayOf(b.date) : "",
    message: b.message,
    country: b.country,
    timezone: b.timezone,
    session_language: b.language,
    locale: b.locale,
    source: "v2",
    ip_hash: ipHash,
    status: "new",
  };

  for (let attempt = 0; attempt < 4; attempt++) {
    const ref = makeRef();
    const { data, error } = await db.from("consultancy_requests").insert({ ...row, ref }).select(SELECT_ROW).single();
    if (!error && data) {
      later(notifyAll(data as RequestRow).then(retryFailed));
      return json(req, 201, { ref });
    }
    if (error?.code !== "23505") {
      console.error("insert failed", error);
      return json(req, 500, { error: "save_failed" });
    }
  }
  return json(req, 500, { error: "save_failed" });
}

async function resend(req: Request): Promise<Response> {
  if (!(await requireAdmin(req))) return json(req, 403, { error: "forbidden" });
  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return json(req, 400, { error: "id required" });
  const { data: row } = await db.from("consultancy_requests").select(SELECT_ROW).eq("id", id).maybeSingle();
  if (!row) return json(req, 404, { error: "not_found" });
  await notifyAll(row as RequestRow, true);
  const { data: log } = await db.from("notification_log").select("channel, status, last_error").eq("request_id", id);
  return json(req, 200, { log });
}

async function rebuild(req: Request): Promise<Response> {
  if (!(await requireAdmin(req))) return json(req, 403, { error: "forbidden" });
  const hook = env("VERCEL_DEPLOY_HOOK_URL");
  if (!hook) return json(req, 501, { error: "not_configured" });
  const res = await fetch(hook, { method: "POST" }).catch(() => null);
  return res?.ok ? json(req, 202, { ok: true }) : json(req, 502, { error: "hook_failed" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "method_not_allowed" });
  const path = new URL(req.url).pathname.replace(/\/+$/, "");
  try {
    if (path.endsWith("/resend")) return await resend(req);
    if (path.endsWith("/rebuild")) return await rebuild(req);
    return await createRequest(req);
  } catch (e) {
    console.error("unhandled", e);
    return json(req, 500, { error: "server_error" });
  }
});
