# Vyana Soul: Supabase backend

The live project is `xvdoutqezjsuogankqna` (the same one the v1 site uses).

```
migrations/20261022000000_v2_foundation.sql   additive changes; safe while v1 is still live
functions/booking/index.ts                    POST /booking, /booking/resend, /booking/rebuild
functions/booking/lib.ts                      validation, reference codes, time windows, message text
functions/booking/lib_test.ts                 deno test
functions/booking/.env.example                the secrets the function reads
```

## What the migration changes

- `consultancy_requests` gains `ref`, `timezone`, `preferred_date`, `session_language`, `locale`, `source`, `ip_hash` and `updated_at`. Statuses and service values are unchanged, so the v1 admin keeps working.
- New table `notification_log`: one row per alert per channel (`telegram`, `owner_email`, `client_email`), so failed alerts can be retried and shown in the admin.
- `reviews` gains `published`, `featured`, `consent_obtained`, `language`, `sort_order` and `updated_at`. The public can read only published reviews, and admins can add, edit and delete them.
- The open "anyone can insert" policies on `consultancy_requests` and `contact_messages` are removed. Both sites write through edge functions that use the service role, so nothing breaks, and nobody can write rows straight in with the public key any more.
- The four reviews the old site showed from code are added as featured rows.
- `is_admin()` gets a fixed `search_path`.

`20261027000000_site_text.sql` (applied 27 October 2026) adds `site_text`, the text edited in the admin's "Website text" tab, and `site_text_history`, every earlier version. Anyone can read the text (it's on the website, and the build reads it with the publishable key); only admins can change it. Nothing the v1 site uses is touched.

## Deploy

```bash
# 1. secrets (create a NEW Telegram bot token first and revoke the old one)
supabase secrets set --project-ref xvdoutqezjsuogankqna \
  TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
  IP_SALT=$(openssl rand -hex 16) \
  ALLOWED_ORIGINS=https://www.vyanasoul.com,https://vyanasoul.com,https://aryanjain281005.github.io \
  SITE_URL=https://www.vyanasoul.com OWNER_EMAIL=vyanasoul369@gmail.com
# optional: RESEND_API_KEY, EMAIL_FROM, TURNSTILE_SECRET_KEY, VERCEL_DEPLOY_HOOK_URL

# 2. database
supabase db push --project-ref xvdoutqezjsuogankqna      # or paste the migration into the SQL editor

# 3. function (it checks admin tokens itself, so the gateway's JWT check is off)
supabase functions deploy booking --project-ref xvdoutqezjsuogankqna --no-verify-jwt
```

Without the Telegram secrets the function still saves every request and records the alert as `skipped`. Requests from `localhost` are always allowed through CORS, for local testing.

## Test

```bash
cd functions/booking && deno test
```
