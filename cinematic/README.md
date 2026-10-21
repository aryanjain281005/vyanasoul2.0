# Vyana Soul — cinematic site

A single-page site for Vyana Soul that opens with a journey through the Akashic library. It runs in one of two modes, picked automatically:

- **3D (default):** a real-time library built in the browser with Three.js. Scrolling moves the camera through five scenes, and visitors can look around and interact.
- **Film:** your graded video, scrubbed frame by frame with scroll. Used for reduced-motion users, browsers without WebGL2, devices too slow for the 3D, or anyone who adds `?film` to the URL.

| Chapter | Sanskrit | 3D scene | Video scene | What it says |
|---|---|---|---|---|
| 1 | अभिलेख (record) | Candle-lit aisle, open book on a lectern | Library with the open book | Every soul keeps a record |
| 2 | पठन (reading) | A golden vortex forms in the aisle | Golden vortex | What a reading is |
| 3 | आकाश (Akasha) | The vault dissolves into the cosmos | Ceiling opens onto the cosmos | What the Akashic Records are |
| 4 | उपचार (healing) | The book rises; stars fall into it | Stars pour into the floating book | Lama Fera and Pranic Healing |
| 5 | स्पष्टता (clarity) | Close-up of the book in radiant light | Radiant open book | 600+ sessions, book a session |

After the journey the page continues with Rekha, sessions, how a session works, courses, reviews, photos, questions and the booking form.

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

To change the 3D scene, edit `src3d/app.js` and rebuild:

```bash
npm i three esbuild
npx esbuild src3d/app.js --bundle --minify --format=esm --target=es2020 --outfile=app3d.js
```

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
main.js           chapter timing, smooth scroll, booking form, and the film player
app3d.js          the 3D library (bundled from src3d/app.js, includes Three.js)
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
- How long the journey lasts on screen is the `.prologue` height in `styles.css`: 1000vh on desktop and 820vh on phones in 3D mode, 900vh and 760vh in film mode.
- The 3D scene follows the same progress windows; its camera path is `KEYS`, `CP` and `CL` in `src3d/app.js`.

## Booking form

The form checks the fields, then opens WhatsApp with the request filled in, addressed to +91 99874 87242. To send it to the existing Supabase booking function instead, replace the `window.open(...)` part of the submit handler in `main.js` with a `fetch` POST to that endpoint.

## Please confirm before going live

- **Session length.** The old site says 50–60 minutes in one place and 60–90 minutes in the FAQ. The new site uses the FAQ wording (mini reading 30 minutes, personal reading 60 to 90 minutes). Change it in the Sessions section if that's wrong.
- **Course fees.** Taken from the old site's course data (₹2,999 to ₹12,999). The old "original price" strike-throughs were dropped.
- **Reviews.** Shortened versions of the four real reviews from the old site, emojis removed.
