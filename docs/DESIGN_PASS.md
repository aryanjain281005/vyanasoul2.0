# Design pass 2: candlelight in the Akashic library

## What exists, and what's missing

The scroll journey (3D library → vortex → cosmos → healing → radiant book) is the site's memorable moment. After it, the page becomes a standard stack of sections: a section title on the left, three identical rounded cards, a 1-2-3 process row, a table, a quote, a photo grid and a form. It's competent, but it could belong to any wellness site, and the library world the film creates is dropped the moment the film ends.

## The idea

**The film doesn't end; you walk into the library.** Everything after the journey uses three materials from the world the film builds:

| Material | Where it shows up |
|---|---|
| **Light**: one warm candle in a dark room | The visitor's pointer carries a lamp. Its light warms the page and reveals gold Devanagari writing on the walls. Featured review words light up as you read. A thread of light connects the three steps. The booking is sealed in gold. |
| **Script**: Devanagari, gold leaf, the headline bar (shirorekha) | A river of mantra words hangs from one continuous gold line. Sessions are bound books on a shelf, titled in Devanagari. Steps are numbered १ २ ३. |
| **Breath**: *vyāna*, the breath that moves through everything | Rekha's portrait sits in a temple arch with a halo that breathes. "Breathe with Rekha" leads three guided breaths before you book. |

Opening: the library doors. The lotus mark draws itself in gold while the 3D library builds, then the two doors part on the first scene, and the headline rises out of the book's light.

## Tokens

Kept from the design system: night ink `#08060f` to `#201937`, text `#f2e8d5`, gold `#e2b467` / `#f0c985`, parchment `#f1e6cf`. Bodoni Moda (display), Hanken Grotesk (text), Tiro Devanagari (script), Mukta (Hindi text).

Added for the bound books only:

| Book | Cover | Why |
|---|---|---|
| Akashic Records | indigo `#241b4f` | The Akasha: night sky |
| Lama Fera | maroon `#5b1726` | Tibetan monastic red |
| Pranic Healing | saffron brown `#5a3512` | Prana, warmth |

They are the same colours as the books in the 3D library, so the shelf continues the film.

## Checked against the generic defaults

| Generic default | Made specific by |
|---|---|
| Cursor spotlight | The lamp reveals the library's own handwriting (Devanagari marginalia) and flickers like a flame. On touch screens it sits still. |
| Big outline marquee | Words hang from one continuous shirorekha line, like a single endless line of Devanagari. They are separated by the verse mark ॥, and their speed follows your scrolling. |
| Tilt cards | Bound books (spine, gilt rules, page edges) on one shelf, which echoes pulling a book in the 3D scene. |
| Scroll-highlighted text | Candlelight passing over handwriting, one word aflame at a time. |
| Success checkmark | A gold lotus seal stamped with the request's reference, then a little gold dust. |

## Rules

- Each effect is either user-led (lamp, breath, books, seal) or tied to reading position (river, thread, words). Sections don't get the usual fade-in on entry.
- With reduced motion: no doors, no lamp, the river stands still, the halo is static, the thread is fully drawn, every word is lit, and the seal appears without the stamp.
- Decorative layers are `aria-hidden`. Real headings and text stay real and translatable.
- Only transforms and opacity are animated. The lamp moves with transforms, so moving the pointer never repaints the page.

## On a phone: the record in your hands

Phones have no pointer to hover with, so the desktop's lamp, book tilt and candlelit photos had nothing to respond to, and the page read as a long stack. On a phone the library is held instead:

| Desktop | Phone |
|---|---|
| The lamp follows the pointer | **Your thumb carries the lamp.** Wherever you touch, the light goes, riding just above your thumb, and the writing on the walls appears. Lift your thumb and it settles back. |
| Books tilt toward the pointer | **A shelf you swipe along.** The front book comes off the shelf toward you, and the others lean in from the edges, turned away (coverflow). Only the front book shows its details. Markers under the shelf jump to a book, and tapping a side book brings it forward. |
| Reviews in a row | **Letters fanned in the hand.** You swipe through them, and the one in front is upright and lit. |
| Photos warm up under the pointer | **The photograph in front is lit**; the rest wait in the dark. |
| Course table | **The index of a book:** course name, dotted leader, fee. Tap a line to open it. |
| Header button | **A pocket booking bar** at the bottom (Book a session + WhatsApp). It appears in the reading room and steps aside for the form and the footer. |

Phones that support it give a light tap when a book or letter settles, gentle pulses with each breath, and a firmer one when the seal stamps. This only happens after the visitor has touched the page, and never with reduced motion.

With reduced motion switched on, the phone shows the still version of everything: the film plays as stills, there are no doors, no lamp and no haptics, and the river stands still. A visitor who has "Remove animations" or "Reduce motion" on will see a calmer page, by design.
