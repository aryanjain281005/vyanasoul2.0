/* Vyana Soul — scroll-driven film + page behaviour
   1. smooth scroll and in-page links   2. film player   3. chapters, rail and progress
   4. header: solid state, menu sheet, current section   5. questions   6. booking request */
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const recording = /[?&]record\b/.test(location.search); // deterministic capture for walkthrough videos
  // "3d": the WebGL library (app3d.js) draws the film; "frames": the graded video frames are drawn here
  const mode3d = document.documentElement.dataset.mode === "3d";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- 1. smooth scroll (skipped for reduced motion) ---------- */
  let lenis = null;
  if (!reduceMotion && !recording && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const SECTION_OFFSET = -16; // land a little above each section so its title clears the header
  const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.8 }) : window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" }));
  const scrollToEl = (el) => {
    if (lenis) return lenis.scrollTo(el, { duration: 1.6, offset: SECTION_OFFSET });
    const y = el.getBoundingClientRect().top + scrollY + SECTION_OFFSET;
    window.scrollTo({ top: y, behavior: reduceMotion ? "auto" : "smooth" });
  };
  // move keyboard focus with the scroll, so the next Tab continues from the section
  const focusQuietly = (el) => {
    if (!el) return;
    if (!el.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };

  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href");
    if (id === "#") return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (menuOpen) setMenu(false, false);
    if (id === "#top") { scrollToY(0); return; }
    scrollToEl(el);
    const service = a.dataset.service;
    if (service) { chooseService(service); focusQuietly(form.querySelector('input[name="service"]:checked')); }
    else focusQuietly(el);
  });

  /* ---------- 2. film player ---------- */
  const SETS = {
    desktop: { n: 239, dir: "frames/desktop", fx: 0.5, fy: 0.5 },
    mobile: { n: 239, dir: "frames/mobile", fx: 0.5, fy: 0.5 },
  };
  const INK = "#08060f";
  const canvas = document.getElementById("film");
  const ctx = mode3d ? null : canvas.getContext("2d", { alpha: false });
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

  if (!mode3d) gsap.ticker.add(() => {
    const d = target - current;
    if (Math.abs(d) > 0.02) { current += reduceMotion || recording ? d : d * 0.25; needsDraw = true; }
    else if (current !== target) { current = target; needsDraw = true; }
    if (needsDraw) { draw(); needsDraw = false; }
  });

  // a few pixels of drift against the cursor gives the light some depth (desktop only)
  if (!mode3d && !reduceMotion && !recording && matchMedia("(pointer: fine)").matches) {
    gsap.set(canvas, { scale: 1.03 });
    const xTo = gsap.quickTo(canvas, "x", { duration: 1.6, ease: "power3" });
    const yTo = gsap.quickTo(canvas, "y", { duration: 1.6, ease: "power3" });
    addEventListener("pointermove", (e) => {
      xTo((e.clientX / innerWidth - 0.5) * -16);
      yTo((e.clientY / innerHeight - 0.5) * -10);
    }, { passive: true });
  }

  /* ---------- 3. chapters, rail and progress ---------- */
  const chapters = $$(".chapter");
  const railButtons = $$(".rail button");
  const progressBar = $(".progress-line span");
  const bounds = [0, 0.14, 0.32, 0.54, 0.82, 1.01];

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
        setActive(self.progress);
        if (mode3d) {
          window.dispatchEvent(new CustomEvent("vs:progress", { detail: { p: self.progress, v: self.getVelocity() } }));
          return;
        }
        if (!set) return;
        target = self.progress * (set.n - 1);
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
    const drift = matchMedia("(max-aspect-ratio: 4/5)").matches ? (ch.dataset.m === "top" ? 0 : -24) : -56;
    if (deva && drift && !reduceMotion) tl.fromTo(deva, { y: 0 }, { y: drift, duration: Math.min(b, 1) - a, ease: "none" }, a);
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

  /* ---------- 4. header: solid state, menu sheet, current section ---------- */
  const header = $(".site-header");
  ScrollTrigger.create({
    trigger: "#content", start: "top 72px", end: "max",
    onToggle: (self) => header.classList.toggle("solid", self.isActive),
  });

  const menuBtn = document.getElementById("menu-btn");
  const menu = document.getElementById("menu");
  // everything outside the header and the menu goes inert while the menu is open,
  // so Tab cycles through the menu and screen readers stay inside it
  const outside = [$("main"), $(".site-footer"), $(".skip"), document.getElementById("record-card")].filter(Boolean);
  let menuOpen = false;
  function setMenu(open, returnFocus = true) {
    if (open === menuOpen) return;
    menuOpen = open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("open", open);
    document.documentElement.classList.toggle("menu-open", open);
    outside.forEach((el) => { el.inert = open; });
    if (lenis) { if (open) lenis.stop(); else lenis.start(); }
    if (!open && returnFocus) menuBtn.focus({ preventScroll: true });
  }
  menuBtn.addEventListener("click", () => setMenu(!menuOpen));
  addEventListener("keydown", (e) => { if (e.key === "Escape" && menuOpen) setMenu(false); });
  matchMedia("(min-width: 960px)").addEventListener("change", (e) => { if (e.matches) setMenu(false, false); });

  // mark the section being read in the header nav and the menu
  const spyLinks = $$('.site-nav a[href^="#"], .menu-links a[href^="#"]');
  const spyIds = [...new Set(spyLinks.map((a) => a.getAttribute("href").slice(1)))];
  let currentId = null;
  const setCurrent = (id) => {
    currentId = id;
    spyLinks.forEach((a) => { if (a.getAttribute("href") === "#" + id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
  };
  spyIds.forEach((id) => {
    const sec = document.getElementById(id);
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: "top 45%", end: "bottom 45%",
      onToggle: (self) => { if (self.isActive) setCurrent(id); else if (currentId === id) setCurrent(null); },
    });
  });

  // the photo strip scrolls sideways on narrow screens: make it reachable by keyboard only then
  const strip = document.getElementById("moment-strip");
  const syncStrip = () => {
    const scrolls = strip.scrollWidth > strip.clientWidth + 2;
    if (scrolls) { strip.setAttribute("tabindex", "0"); strip.setAttribute("role", "region"); strip.setAttribute("aria-label", "Photographs, scroll sideways for more"); }
    else { strip.removeAttribute("tabindex"); strip.removeAttribute("role"); strip.removeAttribute("aria-label"); }
  };

  /* ---------- resize ---------- */
  let lastSet = null;
  function onResize() {
    syncStrip();
    if (mode3d) return;
    sizeCanvas();
    const s = pickSet();
    if (s !== lastSet) { lastSet = s; loadSet(); }
  }
  let rT;
  addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(onResize, 150); });
  onResize();
  setActive(0);
  window.VS = { scrollToY, prologue, reduceMotion, recording };

  /* ---------- 5. questions: answers open with a short height animation ---------- */
  $$(".faq-list details").forEach((d) => {
    const summary = d.querySelector("summary");
    const body = d.querySelector(".faq-a");
    if (!summary || !body || reduceMotion || !body.animate) return;
    let anim = null, closing = false;
    summary.addEventListener("click", (e) => {
      e.preventDefault();
      const from = body.getBoundingClientRect().height;
      if (anim) anim.cancel();
      if (!d.open || closing) {
        closing = false;
        d.open = true;
        const to = body.scrollHeight;
        anim = body.animate([{ height: (d.open && from ? from : 0) + "px", opacity: from ? 1 : 0 }, { height: to + "px", opacity: 1 }], { duration: 320, easing: "cubic-bezier(.2,.7,.2,1)" });
      } else {
        closing = true;
        anim = body.animate([{ height: from + "px", opacity: 1 }, { height: "0px", opacity: 0 }], { duration: 240, easing: "cubic-bezier(.6,0,.3,1)" });
      }
      anim.onfinish = () => {
        if (closing) { d.open = false; closing = false; }
        anim = null;
        ScrollTrigger.refresh();
      };
    });
  });

  /* ---------- 6. booking request → WhatsApp ---------- */
  const WA = "https://wa.me/919987487242?text=";
  const MAIL = "vyanasoul369@gmail.com";
  const form = document.getElementById("book-form");
  const F = form.elements;
  const done = document.getElementById("book-done");
  const submitBtn = document.getElementById("book-submit");
  const submitLabel = submitBtn.querySelector(".btn-label");
  const dateHint = document.getElementById("h-date");
  const mailAlt = document.getElementById("mail-alt");

  // a draft survives a reload or a trip to WhatsApp and back, for this tab only
  const DRAFT = "vs-booking-draft";
  const draft = {
    get() { try { return JSON.parse(sessionStorage.getItem(DRAFT) || "null"); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(DRAFT, JSON.stringify(v)); } catch (e) {} },
    clear() { try { sessionStorage.removeItem(DRAFT); } catch (e) {} },
  };
  const read = () => ({
    name: F.name.value.trim(), phone: F.phone.value.trim(), email: F.email.value.trim(),
    service: F.service.value, date: F.date.value, time: F.time.value, message: F.message.value.trim(),
  });

  // no requests for days already gone (local calendar day)
  const now = new Date();
  F.date.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dayOf = (iso) => new Date(iso + "T12:00:00");
  const niceDay = (iso) => dayOf(iso).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const syncChoices = () => $$(".choice", form).forEach((c) => c.classList.toggle("is-checked", c.querySelector("input").checked));
  function chooseService(value) {
    if (!done.hidden) showForm(false);
    const r = $$('input[name="service"]', form).find((i) => i.value === value);
    if (!r) return;
    r.checked = true;
    showError("service", "");
    syncChoices();
    saveDraft();
  }

  const RULES = {
    name: (v) => (v.name ? "" : "Enter your name so Rekha knows who's writing."),
    phone: (v) => (!v.phone || (/^[+\d][\d\s()-]*$/.test(v.phone) && v.phone.replace(/\D/g, "").length >= 8) ? "" : "Check the number. Use digits only, with the country code if you're outside India."),
    email: (v) => (!v.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) ? "" : "Check the email address. It should look like name@example.com."),
    service: (v) => (v.service ? "" : "Choose a session, or pick “Not sure yet”."),
    date: (v) => (!v.date || v.date >= F.date.min ? "" : "Choose today or a later day."),
  };
  function showError(name, msg) {
    const box = document.getElementById("e-" + name);
    box.querySelector("span").textContent = msg;
    box.hidden = !msg;
    const targets = name === "service" ? $$('input[name="service"]', form) : [F[name]];
    targets.forEach((t) => { if (msg) t.setAttribute("aria-invalid", "true"); else t.removeAttribute("aria-invalid"); });
  }
  const check = (name, v = read()) => { const msg = RULES[name](v); showError(name, msg); return !msg; };

  function updateDateHint() {
    const iso = F.date.value;
    let hint = "";
    if (iso && iso >= F.date.min) {
      const wd = dayOf(iso).getDay();
      if (wd === 0) hint = "Sundays are by appointment. Rekha will confirm whether she can see you.";
      else if (wd === 6) hint = "Saturday sessions run from 10 am to 6 pm IST.";
    }
    dateHint.textContent = hint;
  }

  function message(v) {
    return [
      "Namaste Rekha ji, I'd like to book a session.",
      "",
      `Name: ${v.name}`,
      `Session: ${v.service}`,
      v.date ? `Preferred day: ${niceDay(v.date)}` : null,
      v.time ? `Preferred time: ${v.time} IST` : null,
      v.phone ? `WhatsApp: ${v.phone}` : null,
      v.email ? `Email: ${v.email}` : null,
      v.message ? `\nWhat I'd like to explore: ${v.message}` : null,
    ].filter((l) => l !== null).join("\n");
  }
  const mailto = (v) => `mailto:${MAIL}?subject=${encodeURIComponent("Session request" + (v.name ? " from " + v.name : ""))}&body=${encodeURIComponent(message(v))}`;

  let saveT;
  const saveDraft = () => { clearTimeout(saveT); saveT = setTimeout(() => draft.set(read()), 250); };

  // restore a draft from earlier in this tab
  const saved = draft.get();
  if (saved) {
    ["name", "phone", "email", "date", "message"].forEach((k) => { if (saved[k]) F[k].value = saved[k]; });
    if (saved.service) { const r = $$('input[name="service"]', form).find((i) => i.value === saved.service); if (r) r.checked = true; }
    const t = $$('input[name="time"]', form).find((i) => i.value === (saved.time || "")); if (t) t.checked = true;
    updateDateHint();
  }
  syncChoices();

  // fix errors as people type; check a field when they leave it, once it has something in it
  form.addEventListener("input", (e) => {
    const n = e.target.name;
    if (RULES[n] && (e.target.getAttribute("aria-invalid") === "true")) check(n);
    saveDraft();
  });
  form.addEventListener("change", (e) => {
    const n = e.target.name;
    if (n === "service" || n === "time") { syncChoices(); if (n === "service") showError("service", ""); }
    if (n === "date") { updateDateHint(); check("date"); }
    saveDraft();
  });
  form.addEventListener("focusout", (e) => {
    const n = e.target.name;
    if ((n === "phone" || n === "email") && e.target.value.trim()) check(n);
  });
  mailAlt.addEventListener("click", () => { mailAlt.href = mailto(read()); });

  let sending = false, lastText = "";
  function setLoading(on) {
    sending = on;
    submitBtn.classList.toggle("is-loading", on);
    submitBtn.setAttribute("aria-disabled", String(on));
    submitBtn.toggleAttribute("aria-busy", on);
    submitLabel.textContent = on ? "Opening WhatsApp…" : "Send request on WhatsApp";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (sending) return;
    const v = read();
    let first = null;
    for (const n of ["name", "phone", "email", "service", "date"]) {
      if (!check(n, v) && !first) first = n === "service" ? $('input[name="service"]', form) : F[n];
    }
    if (first) { first.focus(); return; }

    setLoading(true);
    lastText = message(v);
    const url = WA + encodeURIComponent(lastText);
    // open synchronously inside the click so pop-up blockers allow it; a null result means it was blocked
    let win = null;
    if (!recording) { try { win = window.open(url, "_blank"); if (win) win.opener = null; } catch (err) { win = null; } }
    setTimeout(() => { setLoading(false); showDone(url, !!win || recording, v); }, 300);
  });

  const doneH = document.getElementById("done-h");
  const doneMsg = document.getElementById("done-msg");
  const doneOpen = document.getElementById("done-open");
  const doneCopy = document.getElementById("done-copy");
  const doneStatus = document.getElementById("done-status");
  function showDone(url, opened, v) {
    done.classList.toggle("blocked", !opened);
    doneH.textContent = opened ? "Your request is ready in WhatsApp" : "Your request is ready to send";
    doneMsg.textContent = opened
      ? "Press send in WhatsApp and Rekha will confirm within 24 hours. If WhatsApp didn't open, use the button below."
      : "Your browser kept WhatsApp from opening. Open it with the button below, then press send.";
    doneOpen.lastChild.textContent = opened ? "Open WhatsApp again" : "Open WhatsApp";
    doneOpen.href = url;
    document.getElementById("done-summary").textContent = lastText;
    document.getElementById("done-mail").href = mailto(v);
    doneStatus.textContent = "";
    form.hidden = true;
    done.hidden = false;
    draft.clear();
    focusQuietly(doneH);
    ScrollTrigger.refresh();
  }
  function showForm(focus = true) {
    done.hidden = true;
    form.hidden = false;
    ScrollTrigger.refresh();
    if (focus) F.name.focus({ preventScroll: false });
  }
  document.getElementById("done-edit").addEventListener("click", () => showForm(true));

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = Object.assign(document.createElement("textarea"), { value: text });
    ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok;
  }
  let copyT;
  doneCopy.addEventListener("click", async () => {
    const ok = await copy(lastText);
    const label = doneCopy.querySelector(".btn-label");
    clearTimeout(copyT);
    if (ok) {
      label.textContent = "Copied";
      doneStatus.textContent = "Request copied. Paste it into WhatsApp or an email.";
      copyT = setTimeout(() => { label.textContent = "Copy request"; }, 2400);
    } else {
      doneStatus.textContent = "This browser won't allow copying here. Select the request above and copy it instead.";
    }
  });
})();
