import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1.0.8";
import { clientEmail, escapeHtml, makeRef, ownerEmail, telegramText, timeWindow, todayIST, validate, weekdayOf } from "./lib.ts";

const NOW = new Date("2026-10-22T06:00:00Z"); // 11:30 IST
const base = { name: "Asha Verma", phone: "+91 98765 43210", service: "akashic", locale: "en" };

Deno.test("accepts a minimal request and fills defaults", () => {
  const v = validate(base, NOW);
  assert(v.ok);
  if (!v.ok) return;
  assertEquals(v.value.time, "any");
  assertEquals(v.value.email, "");
  assertEquals(v.spam, false);
});

Deno.test("needs a name, a known session and a way to reach the person", () => {
  const v = validate({ name: "A", service: "tarot" }, NOW);
  assert(!v.ok);
  if (v.ok) return;
  assertEquals(Object.keys(v.errors).sort(), ["contact", "name", "service"]);
});

Deno.test("checks phone and email formats", () => {
  const v = validate({ ...base, phone: "call me", email: "not-an-email" }, NOW);
  assert(!v.ok);
  if (v.ok) return;
  assertEquals(Object.keys(v.errors).sort(), ["email", "phone"]);
});

Deno.test("rejects past and far-future dates but allows IST yesterday", () => {
  assert(!validate({ ...base, date: "2026-10-19" }, NOW).ok);
  assert(validate({ ...base, date: "2026-10-21" }, NOW).ok);
  assert(validate({ ...base, date: "2026-12-01" }, NOW).ok);
  assert(!validate({ ...base, date: "2028-01-01" }, NOW).ok);
  assert(!validate({ ...base, date: "2026-02-31x" }, NOW).ok);
});

Deno.test("flags the honeypot and drops unknown time zones", () => {
  const v = validate({ ...base, website: "http://spam", timezone: "Mars/Olympus" }, NOW);
  assert(v.ok && v.spam);
  if (v.ok) assertEquals(v.value.timezone, "");
});

Deno.test("trims and caps long input", () => {
  const v = validate({ ...base, name: "  Asha  ", message: "x".repeat(5000) }, NOW);
  assert(v.ok);
  if (v.ok) {
    assertEquals(v.value.name, "Asha");
    assertEquals(v.value.message.length, 2000);
  }
});

Deno.test("reference codes are VS- plus five unambiguous characters", () => {
  for (let i = 0; i < 200; i++) assertMatch(makeRef(), /^VS-[2-9A-HJKMNP-Z]{5}$/);
  assertEquals(makeRef(() => new Uint8Array([0, 1, 2, 3, 30])), "VS-2345Z");
});

Deno.test("time windows show IST and the visitor's local time", () => {
  assertEquals(timeWindow("any", "", "America/New_York", NOW), { ist: "Any time", local: "" });
  assertEquals(timeWindow("evening", "2026-10-24", "Asia/Kolkata", NOW).local, "");
  // 4 to 8 pm IST on 24 Oct 2026 = 6:30 to 10:30 am in New York (EDT)
  assertEquals(timeWindow("evening", "2026-10-24", "America/New_York", NOW),
    { ist: "Evening, 4 pm to 8 pm IST", local: "6:30 am to 10:30 am New York time" });
  // after the US clocks change (1 Nov 2026), the same window is 5:30 to 9:30 am
  assertEquals(timeWindow("evening", "2026-11-05", "America/New_York", NOW).local, "5:30 am to 9:30 am New York time");
  assertEquals(timeWindow("morning", "2026-10-24", "Europe/London", NOW).local, "4:30 am to 7:30 am London time");
});

Deno.test("dates", () => {
  assertEquals(todayIST(new Date("2026-10-21T20:00:00Z")), "2026-10-22");
  assertEquals(weekdayOf("2026-10-24"), "Saturday");
});

const row = {
  id: "00000000-0000-0000-0000-000000000000", ref: "VS-ABCDE", full_name: "Asha <b>Verma</b>", email: "asha@example.com",
  phone: "+91 98765 43210", service: "personal-reading", preferred_time: "Evening, 4 pm to 8 pm IST", preferred_date: "2026-10-24",
  message: "Career & family", country: "India", timezone: "Asia/Kolkata", session_language: "hi", locale: "hi", created_at: "",
};

Deno.test("telegram text escapes visitor input and links to WhatsApp", () => {
  const t = telegramText(row);
  assert(t.includes("Asha &lt;b&gt;Verma&lt;/b&gt;"));
  assert(t.includes("Career &amp; family"));
  assert(t.includes("Akashic Records reading"));
  assert(t.includes("Saturday 24 October 2026"));
  assert(t.includes("Session in:</b> Hindi"));
  assert(t.includes('href="https://wa.me/919876543210"'));
  assertEquals(escapeHtml("<&>"), "&lt;&amp;&gt;");
});

Deno.test("emails are plain text in the visitor's language", () => {
  const o = ownerEmail(row);
  assert(!o.text.includes("<b>Name"));
  assert(o.text.includes("Asha <b>Verma</b>")); // unescaped back to the original text
  assert(o.text.includes("Reply on WhatsApp: https://wa.me/919876543210"));
  const hi = clientEmail(row, "https://www.vyanasoul.com", "919987487242");
  assert(hi.subject.includes("VS-ABCDE"));
  assert(hi.text.startsWith("नमस्ते"));
  const en = clientEmail({ ...row, locale: "en" }, "https://www.vyanasoul.com", "919987487242");
  assert(en.text.includes("Your reference is VS-ABCDE"));
});
