/* Vyana Soul — scroll-driven film + page behaviour */
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const recording = /[?&]record\b/.test(location.search); // deterministic capture for walkthrough videos
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- smooth scroll (skipped for reduced motion) ---------- */
  let lenis = null;
  if (!reduceMotion && !recording && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.8 }) : window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }));
  const scrollToEl = (el) => (lenis ? lenis.scrollTo(el, { duration: 1.6 }) : el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }));

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id === "#") return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      if (id === "#top") scrollToY(0); else scrollToEl(el);
      const service = a.dataset.service;
      if (service) document.getElementById("f-service").value = service;
    });
  });

  /* ---------- film player ---------- */
  const SETS = {
    desktop: { n: 240, dir: "frames/desktop", fx: 0.62, fy: 0.5 },
    mobile: { n: 180, dir: "frames/mobile", fx: 0.5, fy: 0.38 },
  };
  const INK = "#08060f";
  const canvas = document.getElementById("film");
  const ctx = canvas.getContext("2d", { alpha: false });
  const pctEl = document.getElementById("load-pct");
  const loadingEl = document.querySelector(".rail .loading");

  let set = null, frames = [], loaded = 0, generation = 0;
  let target = 0, current = 0, drawnIndex = -1, needsDraw = true;

  const pickSet = () => (innerWidth / innerHeight < 0.8 ? SETS.mobile : SETS.desktop);
  const frameUrl = (i) => `${set.dir}/f${String(i).padStart(3, "0")}.webp`;

  // coarse-to-fine order: the whole film becomes scrubbable early, then fills in
  function loadOrder(n) {
    const seen = new Set([0, n - 1]);
    const out = [0, n - 1];
    for (const step of [48, 24, 12, 6, 3, 2, 1]) {
      for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); out.push(i); }
    }
    return out;
  }

  function loadSet() {
    set = pickSet();
    const gen = ++generation;
    frames = new Array(set.n);
    loaded = 0;
    const queue = loadOrder(set.n);
    let next = 0, active = 0;
    const pump = () => {
      while (active < 6 && next < queue.length) {
        const i = queue[next++];
        active++;
        const img = new Image();
        img.decoding = "async";
        img.src = frameUrl(i);
        img.decode()
          .then(() => {
            if (gen !== generation) return;
            frames[i] = img;
            loaded++;
            const pct = Math.round((loaded / set.n) * 100);
            if (pctEl) pctEl.textContent = pct;
            if (pct >= 100 && loadingEl) loadingEl.classList.add("done");
            needsDraw = true;
          })
          .catch(() => {})
          .finally(() => { active--; if (gen === generation) pump(); });
      }
    };
    pump();
  }

  function nearestFrame(i) {
    if (frames[i]) return [frames[i], i];
    for (let d = 1; d < set.n; d++) {
      if (frames[i - d]) return [frames[i - d], i - d];
      if (frames[i + d]) return [frames[i + d], i + d];
    }
    return [null, -1];
  }

  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    drawnIndex = -1;
    needsDraw = true;
  }

  function draw() {
    const [img, idx] = nearestFrame(Math.round(current));
    if (!img) return;
    if (idx === drawnIndex && !needsDraw) return;
    const cw = canvas.width, ch = canvas.height;
    const iw = img.naturalWidth, ih = img.naturalHeight;
    // cover the screen; on tall phones fit the width instead (up to 22% letterbox)
    // so wide scenes like the book aren't clipped at the sides
    let s = Math.max(cw / iw, ch / ih);
    const fitW = cw / iw;
    const letterbox = set === SETS.mobile && fitW * ih >= ch * 0.78 && fitW * ih < ch;
    if (letterbox) s = fitW;
    const w = iw * s, h = ih * s;
    // keep the subject's focus point where the art direction put it
    let x = cw * set.fx - set.fx * w;
    let y = letterbox ? (ch - h) * set.fy : ch * set.fy - set.fy * h;
    x = Math.min(0, Math.max(cw - w, x));
    if (!letterbox) y = Math.min(0, Math.max(ch - h, y));
    if (letterbox) { ctx.fillStyle = INK; ctx.fillRect(0, 0, cw, ch); }
    ctx.drawImage(img, x, y, w, h);
    if (letterbox) {
      // feather the frame's top and bottom edges into the page colour
      const f = Math.round(ch * 0.07);
      let g = ctx.createLinearGradient(0, y, 0, y + f);
      g.addColorStop(0, INK); g.addColorStop(1, "rgba(8,6,15,0)");
      ctx.fillStyle = g; ctx.fillRect(0, y - 1, cw, f + 1);
      g = ctx.createLinearGradient(0, y + h - f, 0, y + h);
      g.addColorStop(0, "rgba(8,6,15,0)"); g.addColorStop(1, INK);
      ctx.fillStyle = g; ctx.fillRect(0, y + h - f, cw, f + 1);
    }
    drawnIndex = idx;
  }

  gsap.ticker.add(() => {
    const d = target - current;
    if (Math.abs(d) > 0.02) { current += reduceMotion || recording ? d : d * 0.25; needsDraw = true; }
    else if (current !== target) { current = target; needsDraw = true; }
    if (needsDraw) { draw(); needsDraw = false; }
  });

  // a few pixels of drift against the cursor gives the light some depth (desktop only)
  if (!reduceMotion && !recording && matchMedia("(pointer: fine)").matches) {
    gsap.set(canvas, { scale: 1.03 });
    const xTo = gsap.quickTo(canvas, "x", { duration: 1.6, ease: "power3" });
    const yTo = gsap.quickTo(canvas, "y", { duration: 1.6, ease: "power3" });
    addEventListener("pointermove", (e) => {
      xTo((e.clientX / innerWidth - 0.5) * -16);
      yTo((e.clientY / innerHeight - 0.5) * -10);
    }, { passive: true });
  }

  /* ---------- chapters, rail and progress ---------- */
  const chapters = [...document.querySelectorAll(".chapter")];
  const railButtons = [...document.querySelectorAll(".rail button")];
  const progressBar = document.querySelector(".progress-line span");
  const bounds = [0, 0.16, 0.44, 0.70, 0.90, 1.01];

  function setActive(p) {
    const k = bounds.findIndex((b, i) => p >= b && p < bounds[i + 1]);
    railButtons.forEach((b, i) => {
      b.classList.toggle("active", i === k);
      if (i === k) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
    });
    if (progressBar) progressBar.style.transform = `scaleX(${p})`;
  }

  const prologue = document.getElementById("prologue");
  const tl = gsap.timeline({
    defaults: { ease: "power2.out" },
    scrollTrigger: {
      trigger: prologue,
      start: "top top",
      end: "bottom bottom",
      scrub: reduceMotion || recording ? true : 0.5,
      onUpdate: (self) => {
        if (!set) return;
        target = self.progress * (set.n - 1);
        setActive(self.progress);
      },
    },
  });

  const FADE = 0.028;
  chapters.forEach((ch) => {
    const a = parseFloat(ch.dataset.in), b = parseFloat(ch.dataset.out);
    const deva = ch.querySelector(".deva");
    // chapters with links toggle visibility so hidden links can't take focus;
    // text-only chapters fade by opacity so screen readers can still read them
    const hasLinks = !!ch.querySelector("a, button");
    const prop = hasLinks ? "autoAlpha" : "opacity";
    if (!hasLinks) gsap.set(ch, { visibility: "visible" });
    if (a > 0) tl.fromTo(ch, { [prop]: 0, y: 34 }, { [prop]: 1, y: 0, duration: FADE }, a);
    if (b < 1) tl.to(ch, { [prop]: 0, y: -34, duration: FADE, ease: "power2.in" }, b - FADE);
    // the Sanskrit word drifts slower than the text: a quiet parallax
    if (deva && !reduceMotion) tl.fromTo(deva, { y: 0 }, { y: -56, duration: Math.min(b, 1) - a, ease: "none" }, a);
  });
  tl.set({}, {}, 1); // timeline length = 1, so positions read as scroll progress

  // rail jumps to a chapter
  railButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const p = parseFloat(btn.dataset.go);
      const top = prologue.offsetTop;
      const len = prologue.offsetHeight - innerHeight;
      scrollToY(top + len * p);
    });
  });

  // after the film: dim it, hide chapter stage and rail, keep the sunrise glowing behind content
  gsap.to("#veil", {
    opacity: 0.84, ease: "none",
    scrollTrigger: { trigger: "#content", start: "top bottom", end: "top 25%", scrub: true },
  });
  gsap.to(["#stage", ".rail", ".progress-line"], {
    autoAlpha: 0, ease: "none",
    scrollTrigger: { trigger: "#content", start: "top 92%", end: "top 55%", scrub: true },
  });

  const header = document.querySelector(".site-header");
  ScrollTrigger.create({
    trigger: "#content", start: "top 72px", end: "max",
    onToggle: (self) => header.classList.toggle("solid", self.isActive),
  });

  /* ---------- resize ---------- */
  let lastSet = null;
  function onResize() {
    sizeCanvas();
    const s = pickSet();
    if (s !== lastSet) { lastSet = s; loadSet(); }
  }
  let rT;
  addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(onResize, 150); });
  onResize();
  setActive(0);

  /* ---------- booking form → WhatsApp ---------- */
  const form = document.getElementById("book-form");
  const status = document.getElementById("form-status");
  const setError = (input, id, msg) => {
    const el = document.getElementById(id);
    el.textContent = msg;
    if (msg) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  };
  form.addEventListener("input", (e) => {
    const t = e.target;
    if (t.getAttribute("aria-invalid")) setError(t, "e-" + (t.name === "service" ? "service" : t.name), "");
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const f = form.elements;
    let first = null;
    const name = f.name.value.trim();
    const email = f.email.value.trim();
    const service = f.service.value;
    if (!name) { setError(f.name, "e-name", "Enter your name so Rekha knows who's writing."); first = first || f.name; } else setError(f.name, "e-name", "");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(f.email, "e-email", "Check the email address, it looks incomplete."); first = first || f.email; } else setError(f.email, "e-email", "");
    if (!service) { setError(f.service, "e-service", "Choose a session, or pick “Not sure yet”."); first = first || f.service; } else setError(f.service, "e-service", "");
    if (first) { first.focus(); return; }

    const lines = [
      "Namaste Rekha ji, I'd like to book a session.",
      "",
      `Name: ${name}`,
      `Session: ${service}`,
      f.date.value ? `Preferred day: ${f.date.value}` : null,
      f.time.value ? `Preferred time: ${f.time.value}` : null,
      f.phone.value.trim() ? `WhatsApp: ${f.phone.value.trim()}` : null,
      email ? `Email: ${email}` : null,
      f.message.value.trim() ? `\nWhat I'd like to explore: ${f.message.value.trim()}` : null,
    ].filter((l) => l !== null);
    const url = "https://wa.me/919987487242?text=" + encodeURIComponent(lines.join("\n"));
    window.open(url, "_blank", "noopener");
    status.innerHTML = 'Your request is ready in WhatsApp. If it didn\'t open, <a href="' + url + '" target="_blank" rel="noopener">open it here</a>.';
  });
})();
