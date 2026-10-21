# Vyana Soul — cinematic site

A single-page site for Vyana Soul built around a scroll-driven film. As you scroll, the film plays in five chapters:

| Chapter | Sanskrit | Scene in the film | What it says |
|---|---|---|---|
| 1 | अभिलेख (record) | A candle-lit library with an open book | Every soul keeps a record |
| 2 | पठन (reading) | A golden vortex opens in the library | What a reading is |
| 3 | आकाश (Akasha) | The ceiling opens onto the cosmos | What the Akashic Records are |
| 4 | उपचार (healing) | Light and stars pour into a floating book | Lama Fera and Pranic Healing |
| 5 | स्पष्टता (clarity) | The book opens in radiant light | 600+ sessions, book a session |

After the film the page continues with Rekha, sessions, how a session works, courses, reviews, photos, questions and the booking form.

## Run it locally

Any static server works. From this folder:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly from disk won't load the frames; it needs a server.)

## Deploy

It's plain HTML, CSS and JS with no build step. On Vercel, set the project's root directory to `cinematic/` and deploy; `vercel.json` adds long cache headers for the frames and fonts. Netlify, GitHub Pages or any static host also works.

## Files

```
index.html        page markup and all copy
styles.css        design tokens and layout
main.js           film player, chapter timing, smooth scroll, booking form
frames/desktop/   239 frames, 1920×1080 WebP
frames/mobile/    239 frames, 810×1440 WebP, used when the screen is portrait
assets/           Rekha's photos, favicon, social preview image
fonts/            self-hosted Bodoni Moda, Hanken Grotesk, Tiro Devanagari Sanskrit
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
- How long the film lasts on screen is the `.prologue` height in `styles.css` (900vh on desktop, 760vh on phones).

## Booking form

The form checks the fields, then opens WhatsApp with the request filled in, addressed to +91 99874 87242. To send it to the existing Supabase booking function instead, replace the `window.open(...)` part of the submit handler in `main.js` with a `fetch` POST to that endpoint.

## Please confirm before going live

- **Session length.** The old site says 50–60 minutes in one place and 60–90 minutes in the FAQ. The new site uses the FAQ wording (mini reading 30 minutes, personal reading 60 to 90 minutes). Change it in the Sessions section if that's wrong.
- **Course fees.** Taken from the old site's course data (₹2,999 to ₹12,999). The old "original price" strike-throughs were dropped.
- **Reviews.** Shortened versions of the four real reviews from the old site, emojis removed.
