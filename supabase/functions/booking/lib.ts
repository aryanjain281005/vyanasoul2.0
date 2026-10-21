// Pure helpers for the booking function: validation, reference codes, time windows and
// message text. No I/O here, so everything is covered by lib_test.ts.

export const SERVICES = {
  // value sent by the form -> [value stored in the database (v1 admin compatible), label]
  "akashic": ["personal-reading", "Akashic Records reading"],
  "lama-fera": ["lama-fera", "Lama Fera healing"],
  "pranic": ["pranic-healing", "Pranic Healing"],
  "not-sure": ["not-sure", "Not sure yet"],
} as const;
export type ServiceKey = keyof typeof SERVICES;

// Session windows in IST, as offered on the site
export const SLOTS = {
  any: null,
  morning: { label: "Morning", from: 9, to: 12 },
  afternoon: { label: "Afternoon", from: 12, to: 16 },
  evening: { label: "Evening", from: 16, to: 20 },
} as const;
export type SlotKey = keyof typeof SLOTS;

export interface BookingInput {
  name: string;
  phone: string;
  email: string;
  service: ServiceKey;
  country: string;
  timezone: string;
  date: string; // YYYY-MM-DD or ""
  time: SlotKey;
  language: "en" | "hi" | "";
  message: string;
  locale: "en" | "hi";
}

export type Validation =
  | { ok: true; value: BookingInput; spam: boolean }
  | { ok: false; errors: Record<string, string> };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const PHONE = /^[+\d][\d\s()-]*$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Today's date in IST as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10);
}

export function validate(raw: unknown, now = new Date()): Validation {
  const b = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const errors: Record<string, string> = {};

  const name = str(b.name, 80);
  const phone = str(b.phone, 32);
  const email = str(b.email, 254).toLowerCase();
  const service = str(b.service, 20) as ServiceKey;
  const country = str(b.country, 56);
  const tz = str(b.timezone, 64);
  const date = str(b.date, 10);
  const time = (str(b.time, 12) || "any") as SlotKey;
  const language = str(b.language, 2);
  const message = str(b.message, 2000);
  const locale = str(b.locale, 2) === "hi" ? "hi" : "en";

  if (name.length < 2) errors.name = "name";
  if (phone && !(PHONE.test(phone) && phone.replace(/\D/g, "").length >= 8 && phone.replace(/\D/g, "").length <= 15)) errors.phone = "phone";
  if (email && !EMAIL.test(email)) errors.email = "email";
  if (!phone && !email && !errors.phone && !errors.email) errors.contact = "contact";
  if (!(service in SERVICES)) errors.service = "service";
  if (!(time in SLOTS)) errors.time = "time";
  if (date) {
    const valid = DATE.test(date) && !Number.isNaN(Date.parse(date + "T00:00:00Z"));
    // allow one day of slack for visitors west of India whose "today" is IST's yesterday
    const earliest = new Date(Date.parse(todayIST(now) + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
    const latest = new Date(now.getTime() + 366 * 86400000).toISOString().slice(0, 10);
    if (!valid || date < earliest || date > latest) errors.date = "date";
  }
  if (language && language !== "en" && language !== "hi") errors.language = "language";

  if (Object.keys(errors).length) return { ok: false, errors };

  // honeypot: real visitors never see or fill the "website" field
  const spam = str(b.website, 200) !== "";

  return {
    ok: true,
    spam,
    value: {
      name, phone, email, service, country,
      timezone: isValidTimeZone(tz) ? tz : "",
      date, time,
      language: language as BookingInput["language"],
      message, locale,
    },
  };
}

// Unambiguous alphabet: no 0/O, 1/I/L
const REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function makeRef(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const bytes = rand(5);
  let out = "VS-";
  for (const b of bytes) out += REF_ALPHABET[b % REF_ALPHABET.length];
  return out;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const hourLabel = (h: number) => (h === 12 ? "12 pm" : h === 0 || h === 24 ? "12 am" : h < 12 ? `${h} am` : `${h - 12} pm`);

/** "Saturday 25 October 2026" for a YYYY-MM-DD date. */
export function dayLabel(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
export function weekdayOf(date: string): string {
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

/** The chosen window in IST, plus the same window in the visitor's own time zone when it differs. */
export function timeWindow(slot: SlotKey, date: string, tz: string, now = new Date()): { ist: string; local: string } {
  const s = SLOTS[slot];
  if (!s) return { ist: "Any time", local: "" };
  const ist = `${s.label}, ${hourLabel(s.from)} to ${hourLabel(s.to)} IST`;
  if (!tz || !isValidTimeZone(tz) || ["Asia/Kolkata", "Asia/Calcutta"].includes(tz)) return { ist, local: "" };
  const day = date || todayIST(now);
  const at = (h: number) => new Date(Date.parse(`${day}T00:00:00Z`) + (h * 60 - 330) * 60000);
  const fmt = (d: Date) => d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(" AM", " am").replace(" PM", " pm");
  const local = `${fmt(at(s.from))} to ${fmt(at(s.to))} ${tz.split("/").pop()!.replace(/_/g, " ")} time`;
  return { ist, local };
}

export interface RequestRow {
  id: string;
  ref: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  service: string;
  preferred_time: string | null;
  preferred_date: string | null;
  message: string | null;
  country: string | null;
  timezone: string;
  session_language: string;
  locale: string;
  created_at: string;
}

export function serviceLabel(stored: string): string {
  for (const [, [db, label]] of Object.entries(SERVICES)) if (db === stored) return label;
  return stored || "Not given";
}

const LANG = { en: "English", hi: "Hindi" } as Record<string, string>;

export function telegramText(r: RequestRow, retry = false): string {
  const e = (v: string | null | undefined) => escapeHtml(v || "");
  const lines = [
    `${retry ? "🔁 <b>Re-sent</b> " : "🔔 "}<b>New session request</b> · <code>${e(r.ref)}</code>`,
    "",
    `<b>Name:</b> ${e(r.full_name)}`,
    r.phone ? `<b>WhatsApp:</b> ${e(r.phone)}` : null,
    r.email ? `<b>Email:</b> ${e(r.email)}` : null,
    `<b>Session:</b> ${e(serviceLabel(r.service))}`,
    r.preferred_date ? `<b>Day:</b> ${e(dayLabel(r.preferred_date))}` : null,
    `<b>Time:</b> ${e(r.preferred_time || "Any time")}`,
    r.country ? `<b>Country:</b> ${e(r.country)}${r.timezone ? ` (${e(r.timezone)})` : ""}` : null,
    r.session_language ? `<b>Session in:</b> ${e(LANG[r.session_language] || r.session_language)}` : null,
    r.message ? `\n<b>What they'd like to explore:</b>\n${e(r.message)}` : null,
    r.phone ? `\n<a href="https://wa.me/${r.phone.replace(/\D/g, "")}">Reply on WhatsApp</a>` : null,
  ];
  return lines.filter((l) => l !== null).join("\n");
}

export function ownerEmail(r: RequestRow): { subject: string; text: string } {
  const text = telegramText(r)
    .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, "$2: $1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/^🔔 /, "");
  return { subject: `New session request ${r.ref} from ${r.full_name}`, text };
}

export function clientEmail(r: RequestRow, siteUrl: string, whatsapp: string): { subject: string; text: string } {
  const wa = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Namaste Rekha ji, about my request ${r.ref}`)}`;
  if (r.locale === "hi") {
    return {
      subject: `आपका अनुरोध मिल गया (${r.ref})`,
      text: [
        `नमस्ते ${r.full_name},`,
        "",
        `आपका ${serviceLabel(r.service)} सत्र का अनुरोध रेखा जी तक पहुँच गया है। संदर्भ संख्या: ${r.ref}`,
        "रेखा जी 24 घंटे के भीतर WhatsApp या ईमेल पर आपका समय, भुगतान की जानकारी और तैयारी के लिए एक छोटी गाइड भेजेंगी।",
        "",
        `जल्दी बात करनी हो तो WhatsApp पर लिखें: ${wa}`,
        "",
        "वायना सोल",
        siteUrl,
      ].join("\n"),
    };
  }
  return {
    subject: `We've received your request (${r.ref})`,
    text: [
      `Namaste ${r.full_name},`,
      "",
      `Your request for a ${serviceLabel(r.service)} session has reached Rekha. Your reference is ${r.ref}.`,
      "Rekha will confirm within 24 hours on WhatsApp or by email, with your time, payment details and a short guide to prepare.",
      "",
      `If you'd like to talk sooner, message her on WhatsApp: ${wa}`,
      "",
      "Vyana Soul",
      siteUrl,
    ].join("\n"),
  };
}
