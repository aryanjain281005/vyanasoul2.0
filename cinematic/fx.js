/* Vyana Soul: candlelight in the library (see docs/DESIGN_PASS.md)
   1. library doors and the headline   2. the lamp   3. the mantra river   4. breathe with Rekha
   5. books on the shelf   6. the thread of light   7. words lit by the candle   8. the seal
   Runs after main.js. Everything here is decoration or answers the visitor; with reduced motion
   it stands down to still versions. */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const recording = /[?&]record\b/.test(location.search);
  const fine = matchMedia("(pointer: fine)").matches;
  const still = reduce || recording;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const T = {
    en: {
      start: "Breathe with Rekha", stop: "Stop", again: "Breathe again",
      in: "Breathe in", hold: "Hold", out: "Breathe out",
      count: (n) => `Breath ${n} of 3`,
      after: "Every session begins like this, slowly. When you're ready, book yours.",
      stopped: "Stopped. Start again whenever you like.",
    },
    hi: {
      start: "रेखा जी के साथ साँस लें", stop: "रोकें", again: "फिर से साँस लें",
      in: "साँस लें", hold: "थामें", out: "साँस छोड़ें",
      count: (n) => `${["पहली", "दूसरी", "तीसरी"][n - 1]} साँस`,
      after: "हर सत्र ऐसे ही, धीरे से शुरू होता है। जब मन हो, अपना सत्र बुक करें।",
      stopped: "रुक गया। जब चाहें फिर शुरू करें।",
    },
  }[root.lang === "hi" ? "hi" : "en"];

  /* ---------- 1. the library doors, then the headline rises ---------- */
  const doors = $("#doors");
  const heroH1 = $(".chapter-hero h1");
  const heroRest = $$(".chapter-hero .deva, .chapter-hero .lede, .chapter-hero .actions, .chapter-hero .explore-hint, .chapter-hero .hero-foot");
  if (doors && root.classList.contains("doors-on") && !still) {
    // words wait below their line until the doors part
    if (heroH1) {
      heroH1.innerHTML = heroH1.textContent.trim().split(/\s+/).map((w) => `<span class="hw"><span>${esc(w)}</span></span>`).join(" ");
      gsap.set($$(".hw > span", heroH1), { yPercent: 115 });
    }
    gsap.set(heroRest, { autoAlpha: 0, y: 16 });
    const bar = $("#doors-bar");
    const pct = $("#load-pct");
    const seen = (() => { try { return sessionStorage.getItem("vs-doors") === "1"; } catch (e) { return false; } })();
    const t0 = performance.now();
    const MIN = seen ? 650 : 1900, MAX = 6500;
    const ready = () => (root.dataset.mode === "3d"
      ? root.classList.contains("scene-ready")
      : Number(pct ? pct.textContent : 100) >= 6);
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      try { sessionStorage.setItem("vs-doors", "1"); } catch (e) {}
      bar.style.transform = "scaleX(1)";
      setTimeout(() => doors.classList.add("open"), 260);
      if (heroH1) gsap.to($$(".hw > span", heroH1), { yPercent: 0, duration: 1.25, ease: "power4.out", stagger: 0.075, delay: 0.75 });
      gsap.to(heroRest, { autoAlpha: 1, y: 0, duration: 1, ease: "power3.out", stagger: 0.08, delay: 1.1, clearProps: "transform" });
      setTimeout(() => { doors.remove(); root.classList.remove("doors-on"); }, 2200);
    };
    const wait = () => {
      const t = performance.now() - t0;
      // the bar creeps while the library builds and finishes when it's ready
      bar.style.transform = `scaleX(${Math.min(0.92, t / 3200)})`;
      if ((t >= MIN && ready()) || t >= MAX) open();
      else setTimeout(wait, 90);
    };
    wait();
  } else if (doors) {
    doors.remove();
    root.classList.remove("doors-on");
  }

  /* ---------- 2. the lamp ---------- */
  const lamp = $("#lamp"), glow = $("#lamp-glow"), win = $("#lamp-window"), script = $("#lamp-script");
  if (lamp && !still) {
    // On the walls, by candlelight: Brihadaranyaka Upanishad 1.3.28,
    // "lead me from the unreal to the real, from darkness to light, from death to immortality"
    const LINES = ["असतो मा सद्गमय", "तमसो मा ज्योतिर्गमय", "मृत्योर्मा अमृतं गमय", "ॐ शान्तिः शान्तिः शान्तिः"];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const write = () => {
      seed = 7;
      const rows = [];
      let y = 18, i = 0;
      while (y < innerHeight + 40) {
        const size = [1.05, 1.35, 1.9, 1.2, 2.6][i % 5];
        const line = Array.from({ length: 6 }, (_, k) => LINES[(i + k) % LINES.length]).join("   ।   ");
        rows.push(`<p style="top:${y}px;font-size:${size}rem;transform:translateX(${-(rand() * 420) | 0}px) rotate(${(rand() * 3 - 1.5).toFixed(2)}deg);opacity:${(0.45 + rand() * 0.55).toFixed(2)}">${line}</p>`);
        y += size * 16 * (1.9 + rand() * 0.9);
        i++;
      }
      script.innerHTML = rows.join("");
    };
    write();
    root.classList.add("lamp-ready");
    ScrollTrigger.create({
      trigger: "#content", start: "top 55%", end: "bottom top",
      onToggle: (s) => root.classList.toggle("in-room", s.isActive),
    });
    const R = () => win.offsetWidth / 2;
    let r = R();
    let x = innerWidth * 0.5, y = innerHeight * 0.42, tx = x, ty = y, lx = -1, ly = -1;
    if (fine) addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    const place = () => {
      win.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      script.style.transform = `translate3d(${r - x}px, ${r - y}px, 0)`;
      glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    place();
    gsap.ticker.add((time, dt) => {
      if (!root.classList.contains("in-room")) return;
      // the flame trails the hand a little, as a held lamp does
      const k = 1 - Math.pow(0.86, dt / 16.67);
      x += (tx - x) * k; y += (ty - y) * k;
      if (Math.abs(x - lx) < 0.1 && Math.abs(y - ly) < 0.1) return;
      lx = x; ly = y;
      place();
    });
    let wT;
    addEventListener("resize", () => {
      clearTimeout(wT);
      wT = setTimeout(() => { write(); r = R(); if (!fine) { tx = innerWidth * 0.5; ty = innerHeight * 0.42; } place(); }, 200);
    });
  } else if (lamp) {
    lamp.remove(); glow.remove();
  }

  /* ---------- 3. the mantra river ---------- */
  const river = $(".river");
  if (river) {
    const track = $(".river-track", river), run = $(".river-run", river);
    let runW = 0;
    // repeat the words until the line is two screens and a run wide, so the loop never shows a seam
    const fill = () => {
      $$(".river-run.copy", track).forEach((n) => n.remove());
      runW = run.getBoundingClientRect().width;
      let total = runW;
      while (runW > 0 && total < innerWidth * 2 + runW) {
        const c = run.cloneNode(true);
        c.classList.add("copy");
        track.appendChild(c);
        total += runW;
      }
    };
    fill();
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { fill(); ScrollTrigger.refresh(); });
    let rT;
    addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(fill, 200); });
    if (!still) {
      let pos = 0, vel = 0, active = false;
      ScrollTrigger.create({
        trigger: river, start: "top bottom", end: "bottom top",
        onToggle: (s) => { active = s.isActive; },
        onUpdate: (s) => { vel = s.getVelocity(); },
      });
      gsap.ticker.add((time, dt) => {
        if (!active || !runW) return;
        // drifts on its own; scrolling down hurries it along, scrolling up turns it back
        pos -= (36 + gsap.utils.clamp(-900, 900, vel) * 0.32) * (dt / 1000);
        vel *= Math.pow(0.9, dt / 16.67);
        if (pos <= -runW) pos += runW;
        if (pos > 0) pos -= runW;
        track.style.transform = `translate3d(${pos.toFixed(2)}px, 0, 0)`;
      });
    }
  }

  /* ---------- 4. breathe with Rekha ---------- */
  const fig = $(".rekha-photo"), breathBtn = $("#breath-btn");
  if (fig && breathBtn) {
    const word = $("#breath-word"), status = $("#breath-status"), bookLink = $("#breath-book");
    const dots = $$(".breath-dots i", fig);
    const label = $(".btn-label", breathBtn);
    const PHASES = [["in", 4000, 1, 1.06], ["hold", 2000, 1, 1.06], ["out", 6000, 0.55, 0.94]];
    let running = false, timers = [];
    const set = (dur, ring, halo) => {
      fig.style.setProperty("--bd", `${dur}ms`);
      fig.style.setProperty("--bs", ring);
      fig.style.setProperty("--hs", halo);
    };
    const stop = (finished) => {
      timers.forEach(clearTimeout);
      timers = [];
      running = false;
      set(900, 0.55, 1);
      fig.classList.remove("breathing");
      label.textContent = finished ? T.again : T.start;
      status.textContent = finished ? T.after : T.stopped;
      if (finished) bookLink.hidden = false;
    };
    const start = () => {
      running = true;
      bookLink.hidden = true;
      set(10, 0.55, 0.94);
      fig.classList.add("breathing");
      label.textContent = T.stop;
      dots.forEach((d) => d.classList.remove("on"));
      let t = 700;
      for (let n = 0; n < 3; n++) {
        for (const [name, dur, ring, halo] of PHASES) {
          timers.push(setTimeout(() => {
            word.textContent = T[name];
            status.textContent = `${T.count(n + 1)}: ${T[name]}`;
            dots.forEach((d, i) => d.classList.toggle("on", i <= n));
            set(dur, ring, halo);
          }, t));
          t += dur;
        }
      }
      timers.push(setTimeout(() => { word.textContent = ""; stop(true); }, t));
    };
    breathBtn.addEventListener("click", () => (running ? stop(false) : start()));
    addEventListener("keydown", (e) => { if (e.key === "Escape" && running) stop(false); });
  }

  /* ---------- 5. books on the shelf ---------- */
  $$(".sessions .session-card").forEach((card) => {
    const cover = $(".book-cover", card), book = $(".btn", card);
    if (!cover || !book) return;
    // the cover is a big, friendly target for the same action as the card's button
    cover.addEventListener("click", () => book.click());
    if (!fine || still) return;
    const rx = gsap.quickTo(cover, "--rx", { duration: 0.6, ease: "power3.out" });
    const ry = gsap.quickTo(cover, "--ry", { duration: 0.6, ease: "power3.out" });
    card.addEventListener("pointerenter", () => card.classList.add("pulled", "tilting"));
    card.addEventListener("pointermove", (e) => {
      const b = cover.getBoundingClientRect();
      const px = gsap.utils.clamp(0, 1, (e.clientX - b.left) / b.width);
      const py = gsap.utils.clamp(0, 1, (e.clientY - b.top) / b.height);
      rx((0.5 - py) * 16);
      ry((px - 0.5) * 22);
      cover.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
      cover.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
    });
    card.addEventListener("pointerleave", () => {
      rx(0); ry(0);
      card.classList.remove("pulled");
      setTimeout(() => card.classList.remove("tilting"), 600);
    });
  });

  /* ---------- 6. the thread of light ---------- */
  const steps = $(".steps");
  if (steps) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "thread");
    svg.setAttribute("aria-hidden", "true");
    const dim = document.createElementNS(NS, "path"), lit = document.createElementNS(NS, "path"), bead = document.createElementNS(NS, "circle");
    dim.setAttribute("class", "thread-dim"); lit.setAttribute("class", "thread-lit"); bead.setAttribute("class", "thread-bead");
    bead.setAttribute("r", "4.5");
    svg.append(dim, lit, bead);
    steps.prepend(svg);
    root.classList.add("has-thread");
    const items = $$("li", steps);
    let len = 0, stops = [], progress = still ? 1 : 0;
    const update = (p) => {
      progress = p;
      if (!len) return;
      lit.style.strokeDashoffset = String(len * (1 - p));
      const pt = lit.getPointAtLength(len * p);
      bead.setAttribute("cx", pt.x.toFixed(1));
      bead.setAttribute("cy", pt.y.toFixed(1));
      bead.style.opacity = p > 0.002 && p < 0.998 && !still ? "1" : "0";
      items.forEach((li, i) => li.classList.toggle("lit", p >= stops[i] - 0.0005));
    };
    const layout = () => {
      const base = steps.getBoundingClientRect();
      // the numerals are 56px circles at each step's top-left corner
      const pts = items.map((li) => {
        const b = li.getBoundingClientRect();
        const top = parseFloat(getComputedStyle(li, "::before").top) || 0;
        return [b.left - base.left + 28, b.top - base.top + top + 28];
      });
      if (!pts.length) return;
      svg.setAttribute("width", base.width);
      svg.setAttribute("height", base.height);
      const across = Math.abs(pts[0][1] - pts[pts.length - 1][1]) < 8;
      let d = `M${pts[0][0]},${pts[0][1]}`;
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
        d += across
          ? ` C${x0 + (x1 - x0) * 0.35},${y0 - 34} ${x0 + (x1 - x0) * 0.65},${y1 + 34} ${x1},${y1}`
          : ` C${x0 + 20},${y0 + (y1 - y0) * 0.35} ${x1 - 20},${y0 + (y1 - y0) * 0.65} ${x1},${y1}`;
      }
      dim.setAttribute("d", d);
      lit.setAttribute("d", d);
      len = lit.getTotalLength();
      lit.style.strokeDasharray = String(len);
      stops = items.map((_, i) => i / Math.max(1, items.length - 1));
      update(progress);
    };
    layout();
    ScrollTrigger.addEventListener("refresh", layout);
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(layout);
    if (!still) {
      ScrollTrigger.create({
        trigger: steps, start: "top 78%", end: "bottom 55%", scrub: 0.6,
        onUpdate: (s) => update(s.progress),
      });
    }
  }

  /* ---------- 7. the featured review, lit word by word ---------- */
  const quote = $(".review-feature blockquote p");
  if (quote && !still) {
    // same text, one span per word; screen readers still read it as one sentence
    quote.innerHTML = quote.textContent.trim().split(/\s+/).map((w) => `<span class="w">${esc(w)}</span>`).join(" ");
    const words = $$(".w", quote);
    let shown = -1;
    ScrollTrigger.create({
      trigger: quote, start: "top 80%", end: "bottom 42%", scrub: true,
      onUpdate: (s) => {
        const k = Math.round(s.progress * words.length);
        if (k === shown) return;
        shown = k;
        words.forEach((w, i) => {
          w.classList.toggle("on", i < k);
          w.classList.toggle("flame", i === k - 1 && k < words.length);
        });
      },
    });
  }

  /* ---------- 8. the seal ---------- */
  const LOTUS = '<path d="M16 5.5c3.2 4.3 3.2 10.4 0 16.5-3.2-6.1-3.2-12.2 0-16.5Z"/><path d="M16 22c-1.6-5.3-5.6-9.2-11.2-10.2-.2 6.3 4.8 10.4 11.2 10.2Z"/><path d="M16 22c1.6-5.3 5.6-9.2 11.2-10.2.2 6.3-4.8 10.4-11.2 10.2Z"/><path d="M4.5 24.5c5.2 2.6 17.8 2.6 23 0"/>';
  const sealSVG = (ref) => `<svg viewBox="0 0 120 120" aria-hidden="true">
    <defs>
      <radialGradient id="seal-g" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fbe7b6"/><stop offset=".5" stop-color="#d9aa5c"/><stop offset="1" stop-color="#8d5c1f"/></radialGradient>
      <path id="seal-p" d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0"/>
    </defs>
    <circle cx="60" cy="60" r="57" fill="url(#seal-g)"/>
    <circle cx="60" cy="60" r="53" fill="none" stroke="#7a5216" stroke-width="1.2" stroke-dasharray="1.5 3"/>
    <circle cx="60" cy="60" r="32" fill="none" stroke="#7a5216" stroke-width="1"/>
    <text font-family="Hanken Grotesk, system-ui, sans-serif" font-size="9" font-weight="600" fill="#5c3b0d" letter-spacing="1.6">
      <textPath href="#seal-p" textLength="262" lengthAdjust="spacing">VYANA SOUL ✦ ${esc(ref)} ✦ VYANA SOUL ✦</textPath>
    </text>
    <g transform="translate(44 43)" fill="none" stroke="#4a300c" stroke-width="1.5" stroke-linecap="round">${LOTUS}</g>
  </svg>`;
  function dust(card, from) {
    const c = document.createElement("canvas");
    c.className = "dust";
    card.appendChild(c);
    const b = card.getBoundingClientRect(), s = from.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = b.width * dpr; c.height = b.height * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    const cx = s.left - b.left + s.width / 2, cy = s.top - b.top + s.height / 2;
    const COLORS = ["#fff1cc", "#f0c985", "#e2b467", "#c99a4c"];
    const P = Array.from({ length: 90 }, (_, i) => {
      const a = Math.random() * Math.PI * 2, v = 1.2 + Math.random() * 4.6;
      return { x: cx + Math.cos(a) * 44, y: cy + Math.sin(a) * 44, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1.4, r: 0.6 + Math.random() * 1.9, life: 0.8 + Math.random() * 0.4, c: COLORS[i % 4] };
    });
    let last = performance.now();
    const step = (now) => {
      const k = Math.min(2, (now - last) / 16.67);
      last = now;
      ctx.clearRect(0, 0, b.width, b.height);
      let alive = 0;
      for (const p of P) {
        p.vx *= Math.pow(0.975, k); p.vy = p.vy * Math.pow(0.975, k) + 0.07 * k;
        p.x += p.vx * k; p.y += p.vy * k; p.life -= 0.017 * k;
        if (p.life <= 0) continue;
        alive++;
        ctx.globalAlpha = Math.min(1, p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      if (alive) requestAnimationFrame(step); else c.remove();
    };
    requestAnimationFrame(step);
  }
  addEventListener("vs:sent", (e) => {
    const done = $("#book-done"), card = $(".book-card");
    if (!done) return;
    let seal = $(".seal", done);
    if (!seal) { seal = document.createElement("div"); seal.className = "seal"; done.prepend(seal); }
    seal.innerHTML = sealSVG((e.detail && e.detail.ref) || "");
    done.classList.add("sealed");
    if (still) return;
    seal.classList.remove("stamp");
    void seal.offsetWidth; // restart the stamp for a second request
    seal.classList.add("stamp");
    setTimeout(() => dust(card, seal), 330);
  });
  addEventListener("vs:unsealed", () => { const done = $("#book-done"); if (done) done.classList.remove("sealed"); });
})();
