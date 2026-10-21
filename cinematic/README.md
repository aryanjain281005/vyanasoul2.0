# Vyana Soul — cinematic site

A single-page site for Vyana Soul built around a scroll-driven film. As you scroll, a film made of gold light plays in five chapters:

| Chapter | Sanskrit | What you see | What it says |
|---|---|---|---|
| 1 | बीज (seed) | A star of light with slow orbits | Every soul keeps a record |
| 2 | आकाश (Akasha) | A vortex of gold and violet light | What the Akashic Records are |
| 3 | अभिलेख (record) | An open book written in light; a page turns | What a reading is |
| 4 | उपचार (healing) | A lotus opening over a flower of life | Lama Fera and Pranic Healing |
| 5 | स्पष्टता (clarity) | Sunrise over a sea of light | 600+ sessions, book a session |

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
frames/desktop/   240 frames, 1920×1080 WebP (about 14 MB)
frames/mobile/    180 frames, 810×1440 WebP, used when the screen is portrait
assets/           Rekha's photos, favicon, social preview image
fonts/            self-hosted Bodoni Moda, Hanken Grotesk, Tiro Devanagari Sanskrit
vendor/           GSAP 3.15 + ScrollTrigger, Lenis 1.3 (local copies, no CDN needed)
film-src/         the Python renderer that made the frames
```

## How the film works

The frames aren't AI video. `film-src/film.py` renders every frame from about 450,000 particles of light: each scene is a shape (star, vortex, book, lotus, sea), particles flow between shapes, and the renderer adds real depth of field, bloom, a lens streak and filmic tone mapping. Because it's procedural, the desktop and mobile versions are composed separately instead of cropped.

To change the film (colours, timing, camera) edit `film.py`, then re-render:

```bash
pip install numpy scipy pillow
cd film-src
# desktop: 240 frames; run two copies in parallel with part 0 and part 1 to use two cores
python3 render_all.py landscape 1920 1080 240 0 1 ../frames/desktop 84 --force
python3 render_all.py portrait 810 1440 180 0 1 ../frames/mobile 82 --force
```

About 8 seconds per desktop frame on one CPU core.

## Editing text and timing

- Chapter text lives in `index.html` inside `#stage`. Each `.chapter` has `data-in` and `data-out`, the scroll progress (0 to 1) where it fades in and out. Keep them inside the matching scene: Akasha 0.23–0.37, book 0.51–0.63, lotus 0.75–0.85, dawn from 0.94.
- How long the film lasts on screen is the `.prologue` height in `styles.css` (900vh on desktop, 760vh on phones).

## Booking form

The form checks the fields, then opens WhatsApp with the request filled in, addressed to +91 99874 87242. To send it to the existing Supabase booking function instead, replace the `window.open(...)` part of the submit handler in `main.js` with a `fetch` POST to that endpoint.

## Please confirm before going live

- **Session length.** The old site says 50–60 minutes in one place and 60–90 minutes in the FAQ. The new site uses the FAQ wording (mini reading 30 minutes, personal reading 60 to 90 minutes). Change it in the Sessions section if that's wrong.
- **Course fees.** Taken from the old site's course data (₹2,999 to ₹12,999). The old "original price" strike-throughs were dropped.
- **Reviews.** Shortened versions of the four real reviews from the old site, emojis removed.
