# Vyana Soul v2: Implementation plan

This plan is based on the [project spec](https://github.com/aryanjain281005/vyansoul-v2/blob/main/docs/SPEC.md) and the finished cinematic frontend in `cinematic/`.

## 1. Changes from the spec

The spec assumed a Next.js app. The frontend has since been built as a static site (HTML, CSS and JS, GSAP, a Three.js scene, no framework). Rewriting it in Next.js would add risk and give nothing back, because static HTML is already fully crawlable. So:

| Spec | What we're doing instead | Why |
|---|---|---|
| Next.js server actions | **Supabase Edge Function `booking`** (Deno) | Works with a static frontend; the database and admin accounts are already on Supabase |
| `next-intl` routes | **Static `/hi/` page generated at build time** from `index.html` + `i18n/hi.json` | English stays hand-edited in `index.html`, as the README already describes |
| ISR from the database | **Build-time sync**: `npm run sync` pulls published reviews into `data/`, and `npm run build` renders them into the HTML | Reviews are in the HTML for Google, and the build doesn't depend on the network |
| New `booking_requests` table | **Extend the existing `consultancy_requests` table** | 178 live requests already sit there, and the v1 admin keeps working during the switch |
| Next.js admin | **Static `admin/` page** using supabase-js and row-level security (`is_admin()`) | One small page, no server; the database enforces access |
| Vercel Cron for retries | **Retry inside the booking function** (each new request also re-sends failed alerts) plus a "Resend alert" button in admin | No scheduler to set up or pay for |

Hosting: **GitHub Pages** stays as the preview (built with `--target=preview`, `noindex`). **Production on Vercel** at `www.vyanasoul.com` (built with `--target=production`, indexable).

## 2. Work packages

### WP1. Database (migration `supabase/migrations/20261022000000_v2_foundation.sql`)

All changes are additive and safe for the live v1 site.

- `consultancy_requests`: add `ref` (unique, e.g. `VS-7K3F9`), `timezone`, `preferred_date`, `session_language`, `locale`, `source`, `ip_hash`, `updated_at`.
- New `notification_log` table (channel, status, attempts, last_error), readable by admins only.
- `reviews`: add `published`, `featured`, `consent_obtained`, `language` and `sort_order`. Change public read to `published = true`. Add admin insert/update/delete via `is_admin()`.
- Drop the open anon `INSERT` policies on `consultancy_requests` and `contact_messages`. v1 writes through its edge function with the service role, so it's unaffected, and v2 writes through the new function.
- Add the four reviews currently hard-coded in the frontend (Rudra, Soni, Nayana, Prachi) to `reviews`, marked featured. Every review then lives in one place.
- Add `updated_at` triggers.

### WP2. Booking function (`supabase/functions/booking/`)

- `POST /booking`:
  - Validation (zod), a honeypot field, a rate limit of 5 requests per 10 minutes per hashed IP, and an optional Cloudflare Turnstile check.
  - CORS allow-list taken from env.
  - Saves the request first, then returns `{ ref }` with status 201.
  - Sends the Telegram alert (and owner/client emails through Resend, if a key is set) **after** the response, using `EdgeRuntime.waitUntil`. Each attempt is logged in `notification_log`.
- Each new request also retries up to 5 failed alerts from the last 48 hours.
- `POST /booking/resend` (admin JWT): re-sends the alerts for one request.
- `POST /booking/rebuild` (admin JWT): triggers the Vercel deploy hook so new reviews go live.
- Secrets come from env only: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ALLOWED_ORIGINS`, `IP_SALT`, and the optional `RESEND_API_KEY`, `OWNER_EMAIL`, `EMAIL_FROM`, `TURNSTILE_SECRET_KEY` and `VERCEL_DEPLOY_HOOK_URL`.

### WP3. Booking form on the frontend (`cinematic/main.js`, `index.html`)

- Submitting POSTs to the function. The card then shows "Request sent", the reference number, and **"Also message on WhatsApp"** (prefilled with the reference). WhatsApp stays the instant channel without being the only one.
- If the request fails (offline, server error), the form falls back to the existing WhatsApp flow, so a request is never lost.
- New fields:
  - **Country**, preselected from the browser time zone.
  - **Session language** (English or Hindi).
- The time zone is detected automatically and sent with the request. The time choices show the visitor's local time when they aren't on IST.
- Draft saving, validation and accessibility patterns are kept as they are.

### WP4. Build, SEO and Hindi (`cinematic/tools/`)

- `tools/build.mjs`:
  - writes `/hi/index.html` from `index.html` (`data-i18n` keys + `i18n/hi.json`) and fixes relative paths
  - sets canonical and `hreflang` (en, hi, x-default) and absolute Open Graph URLs
  - adds JSON-LD: `Organization`, `Person`, three `Service` entries, and `FAQPage` built from the visible FAQ
  - renders reviews from `data/reviews.json`
  - writes `robots.txt`, `sitemap.xml`, `llms.txt` and `404.html`
  - preview builds add `noindex`; production builds don't
- `tools/sync.mjs` pulls published reviews from Supabase (anon key and RLS, read-only).
- `tools/check.mjs` fails if a `data-i18n` key is missing in `hi.json` or if an internal link is broken.
- A language switch (EN / हिन्दी) in the header and the menu.
- A self-hosted Devanagari body font (Mukta, 400/500/600), so Hindi pages match the English ones.

### WP5. Admin (`cinematic/admin/`)

- `noindex`. Sign in with email and password or a magic link; only `profiles.role = 'admin'` gets in, enforced by RLS.
- **Requests:**
  - newest first, with a status filter (new, in progress, completed, cancelled) and counts
  - one tap to WhatsApp (prefilled with the reference), call or email
  - change status and private notes
  - a warning badge plus "Resend alert" when an alert failed
- **Reviews:** add, edit, publish, feature and consent toggles, then "Update website" (deploy hook).
- Uses the frontend's design tokens (ink, gold, parchment), so it looks like the same product.

### WP6. Migration of content

| Content | Source | Destination |
|---|---|---|
| Requests (178) | `consultancy_requests` | Same table, nothing to move |
| Reviews (17 + 4) | `reviews` + hard-coded | `reviews` → build → page |
| Gallery (10) | `gallery_images` (hosted on i.ibb.co) | Downloaded, converted to WebP and served from `assets/gallery/` (third-party image hosts are slow and can disappear) |
| Blog | 0 rows in `blog_posts`; the one v1 post is a placeholder in code | Nothing to move; the blog is phase 2 |
| Contact messages (3) | `contact_messages` | Visible in admin |

### WP7. Verification

- Function: unit-test the pure helpers (validation, ref, time-zone labels, Telegram escaping) with `deno test`, then an end-to-end test against the deployed function with one test request, which is then deleted.
- Frontend: run in the browser at 360, 768 and 1440 px, EN and HI; submit success, server-error fallback and validation errors; keyboard-only pass.
- SEO: `curl` the built pages for the canonical, hreflang and JSON-LD; check `robots.txt` and `sitemap.xml`.
- Security: Supabase advisors after the migration; anon must not read requests or notification logs.

## 3. Steps that need the owner or developer

1. **Revoke the old Telegram bot token** (it's in the public v1 repo), create a new one, and set the secrets:
   ```bash
   supabase secrets set --project-ref xvdoutqezjsuogankqna TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... IP_SALT=$(openssl rand -hex 16) ALLOWED_ORIGINS=https://www.vyanasoul.com,https://vyanasoul.com,https://aryanjain281005.github.io
   ```
   Then update the v1 function to read the token from env (or switch v1 off at cut-over).
2. Approve applying the migration and deploying the `booking` function to the live Supabase project.
3. Optional: a Resend API key with the domain verified, a Turnstile site key, and a Vercel deploy hook.
4. At cut-over: point the Vercel project for `vyanasoul.com` at `cinematic/` with `npm run build:prod`, then submit the sitemap in Search Console.

## 4. Content questions carried over (to confirm with Rekha)

The frontend makes some content choices that the spec flagged as unconfirmed. They are left as they are, but need sign-off:

- Course fees and "Past Life Regression".
- Session lengths of "30 to 90 minutes".
- Hours of 9 am to 8 pm, while the v1 slots run 2 to 9 pm.
- "In person in Mumbai".
- Consent from each reviewer to be shown on the site.

## 5. Status (22 October 2026)

| Package | Status |
|---|---|
| WP1 Database migration | **Applied to the live project** on 22 October. Additive only; v1 endpoints checked afterwards and return the same data. The four seed reviews are in `supabase/launch/`, to run at cut-over (the v1 site lists every review row). |
| WP2 Booking function | **Deployed** as `booking` (v1). 12 unit tests pass. Checked live: CORS allow-list, validation (422), test mode and honeypot store nothing. Telegram and email are skipped until the secrets are set. |
| WP3 Booking form | Done. Posts to the function and falls back to WhatsApp. Adds country, session language, the visitor's local times and a honeypot. Tested in the browser against a mock: success, server error, rate limit, server-side validation, "send another". |
| WP4 Build, SEO, Hindi | Done. `npm run build[:prod]`, `check` and `sync`; `/hi/` with 265 translated strings; canonical, hreflang, JSON-LD, robots, sitemap, llms.txt; privacy and 404 pages. |
| WP5 Admin | Done. `/admin/` covers requests, messages and reviews. Tested against a mocked database; needs a real sign-in once the migration is applied. |
| WP6 Content | Reviews: 17 from the database plus the 4 hard-coded ones. Gallery: 10 photos moved off i.ibb.co into `assets/gallery/`, 3 shown on the page. Blog: nothing to move. |
| WP7 Verification | Done. Live end-to-end booking (22 Oct): the request was saved with the correct fields and time zone, and all 3 alerts were logged as skipped (no secrets yet). The test row was deleted. The GitHub Pages preview is published and its form reaches the function in test mode, storing nothing. |
| WP8 Website text (client request, 27 Oct) | Done. Admin tab "Website text" edits every text on both pages, plus the form and breathing messages, with save, a private preview on the real page, and "Update the website". Migration `20261027000000_site_text.sql` applied (new tables only). Tested against a mocked database and with sample edits through the build; needs a real admin sign-in, and the Vercel deploy hook for "Update the website". |
| WP9 Edit mode (client request, 30 Oct) | Done. The admin opens the real page with `?edit` and clicks any text, photo or review to change it in place: text saved per language, photos replaced (resized in the browser, stored in the new `site-photos` bucket) or refocused, reviews edited or added, a list for text that isn't on screen, every unpublished change with Undo, and Publish. Migration `20261030000000_site_photos.sql` applied (new bucket only). Tested on desktop and phone against a mocked database; anonymous uploads are refused by the real database. Publish needs the Vercel deploy hook. |
| WP10 Photo rows, publish before launch (31 Oct) | Done. Photos can be added (several at once), removed and moved between the two rows in edit mode; the build lays out the rows from `site_text` "gallery". Publish works on the preview through a GitHub workflow once `GITHUB_PUBLISH_TOKEN` is set, and the editor reports when the new build is live. `?real-booking` sends a real request from the preview to test bookings end to end. Booking function redeployed (version 4). |

## 6. Still to do (needs the owner or developer)

1. Revoke the old Telegram bot token in @BotFather (it's in the public v1 repo). Then set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` and `IP_SALT` (see `supabase/README.md`).
2. Sign in to `/admin/` once with a real admin account.
3. Optional: Resend (emails), Cloudflare Turnstile, and a Vercel deploy hook for "Update the website".
4. At launch:
   - point the Vercel project for vyanasoul.com at `cinematic/`
   - run `supabase/launch/20261022000100_launch_seed_reviews.sql`
   - submit the sitemap in Search Console
   - switch off the v1 function
5. Get Rekha's sign-off on the content (section 4) and the Hindi translations.
6. Older issues found in the database security check, left alone so the live v1 site isn't affected:
   - `handle_new_user()` has no fixed search_path and can be called by anyone
   - `rls_auto_enable()` can be called by anyone
   - leaked-password protection is off
