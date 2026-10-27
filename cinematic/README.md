# Vyana Soul — cinematic site

A single-page site for Vyana Soul that opens with a journey through the Akashic library. It runs in one of two modes, picked automatically:

- **3D (default):** a real-time library built in the browser with Three.js. Scrolling moves the camera through five scenes, and visitors can look around and interact.
- **Film:** your graded video, scrubbed frame by frame with scroll. Used for reduced-motion users, browsers without WebGL2, devices too slow for the 3D (it switches automatically), or anyone who adds `?film` or `#film` to the URL.

| Chapter | Sanskrit | 3D scene | Video scene | What it says |
|---|---|---|---|---|
| 1 | अभिलेख (record) | Candle-lit aisle, open book on a lectern | Library with the open book | Every soul keeps a record |
| 2 | पठन (reading) | A golden vortex forms in the aisle | Golden vortex | What a reading is |
| 3 | आकाश (Akasha) | The vault dissolves into the cosmos | Ceiling opens onto the cosmos | What the Akashic Records are |
| 4 | उपचार (healing) | The book rises; stars fall into it | Stars pour into the floating book | Lama Fera and Pranic Healing |
| 5 | स्पष्टता (clarity) | Close-up of the book in radiant light | Radiant open book | 600+ sessions, book a session |

After the journey the page continues with Rekha, sessions, how a session works, courses, reviews, photos, questions and the booking form.

## After the film: candlelight in the library

The page after the journey continues the library instead of leaving it (the reasoning is in `../docs/DESIGN_PASS.md`). All of it lives in `fx.js` and section 11 of `styles.css`:

- **Library doors.** Two arched doors cover the page while the 3D library builds. The lotus draws itself, then the doors part and the headline rises word by word. They show once per visit in full, briefly after that, and never with reduced motion.
- **Mantra river.** The words of the journey hang from one endless gold headline bar between the film and Rekha. They drift on their own and follow the speed and direction of your scrolling.
- **Lamp.** On a computer, a warm light follows the pointer through the reading room. It reveals gold writing on the walls: *asato mā sadgamaya, tamaso mā jyotirgamaya…* from the Brihadaranyaka Upanishad, which the footer translates. On touch screens the light stays still and is quieter.
- **Rekha's arch.** Her portrait sits in a temple arch with a halo that breathes, in for four counts and out for six. "Breathe with Rekha" guides three breaths over the photo, then offers the booking.
- **Books on a shelf.** Each session is a bound book: indigo, maroon or saffron, titled in Devanagari. A book slides out and tilts toward the pointer. Clicking it does the same as its "Book this session" button.
- **Thread of light.** A gold thread draws from step to step (१ २ ३) as you scroll through "How a session works".
- **Candlelit words.** The featured review lights up word by word as you read it.
- **The seal.** A saved booking is stamped with a gold lotus seal carrying its reference, with a little gold dust.

**On phones** (the reasoning is in `docs/DESIGN_PASS.md`): the thumb carries the lamp. The sessions become a shelf you swipe along, coverflow-style, with markers under it. Reviews are letters fanned in the hand, and the photo in front is lit. Courses become a book's index that opens line by line. A pocket booking bar sits at the bottom of the screen. Phones that support vibration give small haptic taps.

Every one of these is `aria-hidden` decoration or answers the visitor. With reduced motion they become still versions (no doors or lamp, a static river and halo, the thread fully drawn, every word lit, the seal without the stamp).

## Design system

After the journey the page is a quiet "reading room". All values are tokens at the top of `styles.css`:

- **Colour:** four ink surfaces (`--ink-0` page to `--ink-3` raised), three text tiers, gold kept for actions and key facts, and one parchment surface for the booking card. Every text pair passes WCAG AA (the lowest, muted text on a card, is 6.9:1); control borders are 3:1 or more.
- **Type:** Bodoni Moda for headings and quotes only, Hanken Grotesk for everything you read or tap, on a fluid scale (`--fs-sm` 14px to `--fs-3xl` 80px).
- **Space and shape:** a 4px spacing scale, radii 10 / 14 / 22 / pill, two shadows, and three motion speeds (120 / 200 / 320 ms) with one easing.
- **Components:** buttons in four roles (primary gold, secondary, gold outline, ink on parchment), each with hover, pressed, focus, disabled and loading states; contact rows; choice cards (visible radios); help strips; the course table that turns into cards below 960px.
- **Breakpoints follow the content:** the booking card lays itself out by its own width (container queries at 500 and 620px); the header nav appears at 960px; sessions go three across at 1100px; the chapter rail needs 1100px.

Accessibility: skip link, visible focus everywhere, 44px minimum tap targets, labelled controls with linked error messages, information never carried by colour alone (level pips also say the level; choices show a filled dot), a menu that keeps focus inside while open and returns it on close, and reduced motion respected (still film, no smooth scroll, no looping hint, instant answers).

## The 3D library

What visitors can do:
- move the pointer (or swipe sideways on a phone) to look around; drag to turn further
- watch the gold dust swirl away from the cursor
- hover a book on the shelves to slide it out, click it to bring it to you and read one of the client reviews, click again or press Escape to put it back
- click the open book on the lectern to turn a page; "Pull a record for me" does the same for keyboard users

How it's built (`src3d/app.js`, bundled to `app3d.js`):
- everything is generated in code: about 17,000 instanced books, shelves and arches, floating candles with flickering flames, a rug and stone floor, and a book whose pages carry real Devanagari text drawn on a canvas
- particle shaders for the dust, the vortex (which becomes the galaxy), and the falling stars; a procedural nebula sky
- glow from Three.js bloom post-processing with filmic tone mapping
- phones get fewer books, particles and lights; any device that runs slowly steps down its resolution, and if it still can't keep up it switches to the film version

Performance:
- book lighting is baked once on load (each book's light from the aisle lamps and sky), so the 15,000+ books cost almost nothing to light; only the lectern lamp and the glowing book are lit live
- the wood, floor and candles use a cheap lighting model with four live lights (two on phones)
- the scene is drawn in the same frame as the smooth scroll, so the camera never lags the page
- resolution adapts every half second to hold about 60 fps, and rises again on fast GPUs
- once the visitor scrolls past the journey, the scene stops rendering entirely
- add `#fps` to the URL to see the frame rate, resolution and draw calls in the corner

To change the 3D scene, edit `src3d/app.js` and rebuild (Three.js is pinned to r186, so the bundle comes out byte for byte the same):

```bash
npm install
npm run build:3d
```

## Run it locally

`index.html`, `privacy.html` and `404.html` are the English sources and run as they are. The deployable site (Hindi page, reviews from the database, SEO files) is built into `dist/`:

```bash
npm install
npm run build        # preview build into dist/ (noindex)
npm run dev          # serves dist/ at http://localhost:8000
```

Any static server pointed at this folder also works for quick edits to the English page (`python3 -m http.server 8000`), but the Hindi link needs a build.

| Command | What it does |
|---|---|
| `npm run check` | Every English string has a Hindi translation; in-page links and alt text are in place |
| `npm run sync` | Pulls published reviews and the text edited in the admin from Supabase into `data/reviews.json` and `data/site-text.json` |
| `npm run build` / `npm run build:prod` | Builds `dist/` for the GitHub Pages preview (noindex) or for www.vyanasoul.com (indexable) |
| `npm run build:3d` / `npm run build:admin` | Rebundle `app3d.js` from `src3d/`, or `admin/admin.js` from `admin-src/` |
| `npm run deploy:preview` | Builds the preview and publishes it to the `gh-pages` branch |

## Deploy

**Production (www.vyanasoul.com) on Vercel.** Set the project's root directory to `cinematic/`. `vercel.json` runs `npm run sync && npm run build:prod`, serves `dist/`, redirects the old v1 addresses (`/dashboard`, `/courses`, `/blog`), adds security headers, and keeps `/admin/` out of search. To let the admin's "Update the website" button redeploy, create a deploy hook in Vercel and save it as the `VERCEL_DEPLOY_HOOK_URL` secret of the booking function.

**Preview (GitHub Pages).** `npm run deploy:preview` builds with `noindex` and force-pushes `dist/` to `gh-pages`.

**Booking backend (Supabase).** The function and migration live in `../supabase/`; see the README there.

## Files

```
index.html        page markup and all English copy (the source of both language versions)
privacy.html      privacy notice          404.html   page-not-found
styles.css        design tokens and layout
main.js           chapter timing, smooth scroll, header menu, questions, booking form, film player
fx.js             doors, lamp, mantra river, breathing, books, thread, candlelit words, seal
app3d.js          the 3D library (bundled from src3d/app.js, includes Three.js)
admin/            the owner's admin page (admin.js is bundled from admin-src/admin.js)
i18n/hi.json      Hindi translations, keyed by the English text
data/reviews.json published reviews, from `npm run sync`
data/site-text.json text edited in the admin, from `npm run sync`
tools/            build, check, sync, local server and preview deploy
frames/desktop/   239 frames, 1920×1080 WebP
frames/mobile/    239 frames, 810×1440 WebP, used when the screen is portrait
assets/           Rekha's photos (gallery/ holds the photos moved over from the old site), favicon, social image
fonts/            self-hosted Bodoni Moda, Hanken Grotesk, Tiro Devanagari Sanskrit, Mukta (Devanagari text)
vendor/           GSAP 3.15 + ScrollTrigger, Lenis 1.3 (local copies, no CDN needed)
film-src/         grade.py (the colour grade) and particles/ (the earlier procedural film)
```

## How the film works

The film is your 10-second video (239 frames at 24 fps) with a cinematic grade applied by `film-src/grade.py`:

- deeper, indigo-black shadows and a gentle S-curve for depth
- the cyan haze and nebula turned toward violet-indigo
- warm gold highlights with bloom, so candles and stars glow like light
- light sharpening, a vignette, and blacks matched to the page colour

Desktop frames are 1920×1080; phone frames are a centred 9:16 cut at 810×1440.

To grade a new video:

```bash
pip install numpy scipy pillow
mkdir src && ffmpeg -i your-video.mp4 -vsync 0 src/f%03d.png
python3 film-src/grade.py src graded 0 1
# then replace frames/desktop and frames/mobile with graded/desktop and graded/mobile
# and set n in SETS at the top of main.js to the number of frames
```

`film-src/particles/` holds an earlier, fully procedural version of the film (gold-light particles, no video). It's kept in case you want it back.

## Editing text and timing

- Chapter text lives in `index.html` inside `#stage`. Each `.chapter` has `data-in` and `data-out`, the scroll progress (0 to 1) where it fades in and out. Progress 0.1 is 1 second into the video. Current windows: library 0–0.12, vortex 0.165–0.30, cosmos 0.345–0.515, light into the book 0.57–0.765, radiant book from 0.905.
- How long the journey lasts on screen is the `.prologue` height in `styles.css`: 1000vh on desktop and 820vh on phones in 3D mode, 900vh and 760vh in film mode.
- The 3D scene follows the same progress windows; its camera path is `KEYS`, `CP` and `CL` in `src3d/app.js`.

## Navigation

- Wide screens get the header nav, which underlines the section you're reading. Below 960px a menu button opens a full-screen sheet with every section plus WhatsApp and call shortcuts; Escape or choosing a link closes it.
- "Skip the journey" sits under the hero (and as the first Tab stop) for anyone who doesn't want to scroll through the film.
- In-page links move keyboard focus with the scroll.

## Booking form

You need a name, a session, and a WhatsApp number or an email. Sessions, times and the session language are tappable choices; "Book this session" on a session card picks that session and jumps to the form. The country is preselected from the visitor's time zone, and visitors outside India see each IST window in their own time ("6:30 am to 10:30 am your time"). Days in the past can't be chosen, and Saturday or Sunday picks show the hours for that day. A draft is kept for the tab, so a reload doesn't lose it.

Sending posts the request to the Supabase `booking` function (the address is in `<meta name="vs-booking-endpoint">`). The function saves it, replies with a reference such as `VS-7K3F9`, then sends Rekha a Telegram alert (and emails, if set up). The card shows "Request sent", the reference, "Message Rekha on WhatsApp" (prefilled with the reference), "Copy request" and "Send another request".

If the function can't be reached, or rate-limits the visitor, nothing is lost: the card switches to "Send your request on WhatsApp instead", with the request ready to send and an email route. Remove the meta tag and the form goes straight to WhatsApp, as it did before.

Spam protection: a hidden honeypot field, a limit of 5 requests per 10 minutes per connection, and optional Cloudflare Turnstile (put the site key in `<meta name="vs-turnstile-sitekey">` and the secret in the function).

## Hindi page

`/hi/` is built from `index.html`: every text and label is looked up in `i18n/hi.json` by its English wording. When you change English text, `npm run check` lists what needs a new translation, and a production build refuses to finish until it has one. Reviews stay in the language they were written in (`translate="no"`). The booking form's messages are in `main.js` (the `T` object). Hindi headings use Tiro Devanagari and Hindi text uses Mukta. The translations are a first draft and should be read by Rekha or a fluent writer.

## Reviews

Reviews come from the `reviews` table: the first four featured reviews appear on the page, and every other published review sits under "Read N more reviews". Rekha manages them in the admin (add, edit, show or hide, feature, and record the client's consent), then presses "Update the website". The 3D library's books read the featured reviews from the page.

## Admin

`/admin/` is for Rekha and the developer: sign in with the email and password from the old site, a magic link, or Google (magic links and Google need the admin's address in Supabase → Authentication → URL configuration). It shows:
- **Requests**: new and in-progress first, search, one tap to WhatsApp/call/email, status and private notes, plus a warning with "Send again" if an alert didn't reach Telegram
- **Messages**: contact messages
- **Reviews**: as above
- **Website text**: every text on the English and Hindi pages, see below

Access is enforced by row-level security (`profiles.role = 'admin'`), not by the page.

## Website text (edited in the admin)

Rekha can change any text on the site without touching code: headings, paragraphs, buttons, fees, questions and answers, form labels, image descriptions, the title and description Google shows, the privacy page, and the messages the booking form and "Breathe with Rekha" write. Each language is edited on its own.

- `index.html`, `privacy.html`, `i18n/hi.json` and the `T` objects in `main.js` and `fx.js` stay the originals. An edit is a row in the `site_text` table, keyed by the original English text (or `js:form.<name>` / `js:breath.<name>` for script messages), with `en` and `hi` columns; null keeps the original.
- `npm run build` puts the edits in place of the originals (`translate(..., { all: true })` in `tools/lib.mjs`), embeds edited script messages as `<script type="application/json" id="vs-text">`, and writes `dist/admin/texts.json`: every editable text with its section, what it is, the original and what this build shows. Prices and numbers follow the English edit on the Hindi page.
- Saving in the admin writes `site_text`. **Preview on the page** stores the edits in the browser and opens the site with `?preview-text`, which shows them with a notice; only that browser sees them. **Update the website** calls the booking function's `/rebuild`, which runs the Vercel deploy hook (`npm run sync && npm run build:prod`).
- Every earlier version is kept in `site_text_history`, so a mistaken edit can be put back from the SQL editor.
- If the developer changes a text in `index.html`, its old edit no longer matches; the admin lists it under "No longer on the site", and the build says how many there are.
- Email addresses and phone numbers aren't in the editor: they are also inside links, so they're changed in `tools/config.mjs`, `index.html` and `main.js`. Reviews are edited in the Reviews tab.

## Search engines

The production build adds a canonical link, `hreflang` for English and Hindi, absolute social-card URLs, and structured data (Organization, Person, the three Services, and an FAQPage built from the visible questions). It also writes `robots.txt`, `sitemap.xml` (both languages) and `llms.txt`. Preview builds are `noindex` and disallow crawling. After launch, submit `https://www.vyanasoul.com/sitemap.xml` in Google Search Console.

## Please confirm before going live

- **Session length.** The old site says 50–60 minutes in one place and 60–90 minutes in the FAQ. The new site uses the FAQ wording (mini reading 30 minutes, personal reading 60 to 90 minutes). Change it in the Sessions section if that's wrong.
- **Course fees.** Taken from the old site's course data (₹2,999 to ₹12,999). The old "original price" strike-throughs were dropped.
- **Reviews.** The four featured reviews are shortened versions of reviews from the old site. Record each client's consent in the admin.
- **Hindi translations.** A first draft; have Rekha or a fluent writer read `i18n/hi.json` (or the `/hi/` page).
- **Privacy notice.** A plain-language draft in `privacy.html`; Rekha should confirm the 24-month retention period.
