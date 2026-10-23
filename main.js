/* Vyana Soul — scroll-driven film + page behaviour
   1. smooth scroll and in-page links   2. film player   3. chapters, rail and progress
   4. header: solid state, menu sheet, current section   5. questions   6. booking request (function, WhatsApp fallback) */
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
  // pages below the site root (the Hindi page at /hi/) set vs-root so shared files resolve
  const ROOT = document.querySelector('meta[name="vs-root"]')?.content || "";
  const SETS = {
    desktop: { n: 239, dir: ROOT + "frames/desktop", fx: 0.5, fy: 0.5 },
    mobile: { n: 239, dir: ROOT + "frames/mobile", fx: 0.5, fy: 0.5 },
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
  const strips = $$(".moment-strip");
  const STRIP_LABEL = document.documentElement.lang === "hi" ? "तस्वीरें, और देखने के लिए दाएँ-बाएँ स्क्रॉल करें" : "Photographs, scroll sideways for more";
  const syncStrip = () => strips.forEach((strip) => {
    const scrolls = strip.scrollWidth > strip.clientWidth + 2;
    if (scrolls) { strip.setAttribute("tabindex", "0"); strip.setAttribute("role", "region"); strip.setAttribute("aria-label", STRIP_LABEL); }
    else { strip.removeAttribute("tabindex"); strip.removeAttribute("role"); strip.removeAttribute("aria-label"); }
  });

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

  /* ---------- 6. booking request → booking function, WhatsApp as the fallback ---------- */
  const PAGE_LANG = document.documentElement.lang === "hi" ? "hi" : "en";
  const T = {
    en: {
      errName: "Enter your name so Rekha knows who's writing.",
      errPhone: "Check the number. Use digits only, with the country code if you're outside India.",
      errEmail: "Check the email address. It should look like name@example.com.",
      errContact: "Add a WhatsApp number or an email so Rekha can reach you.",
      errService: "Choose a session, or pick “Not sure yet”.",
      errDate: "Choose today or a later day.",
      hintSun: "Sundays are by appointment. Rekha will confirm whether she can see you.",
      hintSat: "Saturday sessions run from 10 am to 6 pm IST.",
      timeLocal: (city) => `Times are India time (IST). Under each one is the same time in ${city}.`,
      yourTime: (a, b) => `${a} to ${b} your time`,
      send: "Send request", sending: "Sending…", opening: "Opening WhatsApp…",
      sentH: "Request sent",
      sentMsg: "Rekha will confirm within 24 hours on WhatsApp or by email, with your time, payment details and a short guide to prepare.",
      sentOpen: "Message Rekha on WhatsApp", another: "Send another request",
      testMsg: "This is the preview site, so the request was checked but not sent to Rekha. On www.vyanasoul.com it reaches her straight away.",
      failH: "Send your request on WhatsApp instead",
      failMsg: "We couldn't reach the booking system just now, so this request wasn't sent. It's ready below: open WhatsApp, press send, and Rekha will confirm within 24 hours.",
      rateMsg: "Several requests came from this connection in the last few minutes, so this one wasn't saved. If it's a new request, send it on WhatsApp instead.",
      waH: "Your request is ready in WhatsApp", waBlockedH: "Your request is ready to send",
      waMsg: "Press send in WhatsApp and Rekha will confirm within 24 hours. If WhatsApp didn't open, use the button below.",
      waBlockedMsg: "Your browser kept WhatsApp from opening. Open it with the button below, then press send.",
      openWa: "Open WhatsApp", openWaAgain: "Open WhatsApp again", edit: "Edit request",
      copy: "Copy request", copied: "Copied",
      copyOk: "Request copied. Paste it into WhatsApp or an email.",
      copyFail: "This browser won't allow copying here. Select the request above and copy it instead.",
      msgHello: "Namaste Rekha ji, I'd like to book a session.",
      msgAfter: (ref) => `Namaste Rekha ji, I've just sent a session request on your website. My reference is ${ref}.`,
      fName: "Name", fRef: "Reference", fSession: "Session", fDay: "Preferred day", fTime: "Preferred time", fCountry: "Country",
      fLang: "Session in", fPhone: "WhatsApp", fEmail: "Email", fMsg: "What I'd like to explore",
      subject: (n) => "Session request" + (n ? " from " + n : ""),
      dateLocale: "en-IN",
    },
    hi: {
      errName: "अपना नाम लिखें, ताकि रेखा जी जान सकें कि कौन लिख रहा है।",
      errPhone: "नंबर दोबारा देखें। केवल अंक लिखें, और भारत से बाहर हों तो देश का कोड भी।",
      errEmail: "ईमेल पता दोबारा देखें। यह name@example.com जैसा होना चाहिए।",
      errContact: "WhatsApp नंबर या ईमेल में से कोई एक लिखें, ताकि रेखा जी आपसे संपर्क कर सकें।",
      errService: "एक सत्र चुनें, या “अभी तय नहीं” चुनें।",
      errDate: "आज या आगे का कोई दिन चुनें।",
      hintSun: "रविवार को सत्र केवल पहले से तय समय पर होते हैं। रेखा जी बताएँगी कि वे मिल पाएँगी या नहीं।",
      hintSat: "शनिवार को सत्र सुबह 10 बजे से शाम 6 बजे (IST) तक होते हैं।",
      timeLocal: (city) => `समय भारतीय समय (IST) में है। हर विकल्प के नीचे ${city} का समय दिया है।`,
      yourTime: (a, b) => `आपके समय से ${a} से ${b}`,
      send: "अनुरोध भेजें", sending: "भेजा जा रहा है…", opening: "WhatsApp खुल रहा है…",
      sentH: "अनुरोध भेज दिया गया",
      sentMsg: "रेखा जी 24 घंटे के भीतर WhatsApp या ईमेल पर आपका समय, भुगतान की जानकारी और तैयारी की छोटी गाइड भेजकर पुष्टि करेंगी।",
      sentOpen: "रेखा जी को WhatsApp करें", another: "एक और अनुरोध भेजें",
      testMsg: "यह वेबसाइट का प्रीव्यू है, इसलिए अनुरोध की जाँच हुई पर यह रेखा जी तक नहीं भेजा गया। www.vyanasoul.com पर यह तुरंत उन तक पहुँचता है।",
      failH: "यह अनुरोध WhatsApp से भेजें",
      failMsg: "अभी बुकिंग सिस्टम तक नहीं पहुँच पाए, इसलिए यह अनुरोध नहीं भेजा गया। अनुरोध नीचे तैयार है: WhatsApp खोलें और भेजें, रेखा जी 24 घंटे में पुष्टि करेंगी।",
      rateMsg: "पिछले कुछ मिनटों में इस कनेक्शन से कई अनुरोध आए हैं, इसलिए यह सेव नहीं हुआ। अगर यह नया अनुरोध है, तो इसे WhatsApp से भेजें।",
      waH: "आपका अनुरोध WhatsApp में तैयार है", waBlockedH: "आपका अनुरोध भेजने के लिए तैयार है",
      waMsg: "WhatsApp में भेजें दबाएँ, रेखा जी 24 घंटे में पुष्टि करेंगी। WhatsApp न खुले तो नीचे का बटन दबाएँ।",
      waBlockedMsg: "आपके ब्राउज़र ने WhatsApp खुलने से रोक दिया। नीचे के बटन से खोलें और भेजें।",
      openWa: "WhatsApp खोलें", openWaAgain: "WhatsApp फिर से खोलें", edit: "अनुरोध बदलें",
      copy: "अनुरोध कॉपी करें", copied: "कॉपी हो गया",
      copyOk: "अनुरोध कॉपी हो गया। इसे WhatsApp या ईमेल में पेस्ट करें।",
      copyFail: "यह ब्राउज़र यहाँ कॉपी नहीं करने देता। ऊपर के अनुरोध को चुनकर कॉपी करें।",
      msgHello: "नमस्ते रेखा जी, मुझे एक सत्र बुक करना है।",
      msgAfter: (ref) => `नमस्ते रेखा जी, मैंने अभी वेबसाइट पर सत्र का अनुरोध भेजा है। मेरी संदर्भ संख्या ${ref} है।`,
      fName: "नाम", fRef: "संदर्भ", fSession: "सत्र", fDay: "पसंदीदा दिन", fTime: "पसंदीदा समय", fCountry: "देश",
      fLang: "सत्र की भाषा", fPhone: "WhatsApp", fEmail: "ईमेल", fMsg: "किस बारे में बात करनी है",
      subject: (n) => "सत्र का अनुरोध" + (n ? ": " + n : ""),
      dateLocale: "hi-IN",
    },
  }[PAGE_LANG];

  const WA_NUMBER = "919987487242";
  const WA = `https://wa.me/${WA_NUMBER}?text=`;
  const MAIL = "vyanasoul369@gmail.com";
  const meta = (n) => (document.querySelector(`meta[name="${n}"]`)?.content || "").trim();
  const ENDPOINT = meta("vs-booking-endpoint");
  const SITEKEY = meta("vs-turnstile-sitekey");
  const TEST_MODE = meta("vs-booking-mode") === "test"; // preview site: checked by the function, never saved

  const form = document.getElementById("book-form");
  const F = form.elements;
  const done = document.getElementById("book-done");
  const submitBtn = document.getElementById("book-submit");
  const submitLabel = submitBtn.querySelector(".btn-label");
  const dateHint = document.getElementById("h-date");
  const timeHint = document.getElementById("h-time");
  const mailAlt = document.getElementById("mail-alt");
  const waAlt = document.getElementById("wa-alt");

  /* the visitor's time zone sets the country and the local-time hints */
  let TZ = "";
  try { TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  const IN_INDIA = !TZ || /^Asia\/(Kolkata|Calcutta)$/.test(TZ);
  const TZ_COUNTRY = [
    [/^Asia\/(Kolkata|Calcutta)$/, "India"], [/^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|Regina|St_Johns|Montreal)$/, "Canada"],
    [/^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana)|Pacific\/Honolulu|US\/)/, "United States"],
    [/^Europe\/London$/, "United Kingdom"], [/^Australia\//, "Australia"], [/^Asia\/Dubai$/, "United Arab Emirates"],
    [/^Asia\/Singapore$/, "Singapore"], [/^Pacific\/Auckland$/, "New Zealand"], [/^Asia\/(Kathmandu|Katmandu)$/, "Nepal"],
    [/^Europe\/Berlin$/, "Germany"], [/^Europe\/Amsterdam$/, "Netherlands"], [/^Europe\/Dublin$/, "Ireland"],
    [/^Asia\/Riyadh$/, "Saudi Arabia"], [/^Asia\/Qatar$/, "Qatar"], [/^Asia\/Kuwait$/, "Kuwait"], [/^Asia\/Muscat$/, "Oman"],
    [/^Asia\/Kuala_Lumpur$/, "Malaysia"], [/^Africa\/Johannesburg$/, "South Africa"], [/^Indian\/Mauritius$/, "Mauritius"],
  ];
  const guessCountry = () => (TZ_COUNTRY.find(([re]) => re.test(TZ)) || [null, TZ ? "Other" : "India"])[1];
  const defaults = () => { F.country.value = guessCountry(); const l = $(`input[name="language"][value="${PAGE_LANG}"]`, form); if (l) l.checked = true; };

  const SLOT_HOURS = { morning: [9, 12], afternoon: [12, 16], evening: [16, 20] };
  const fmtTime = (d) => d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).replace(":00", "").replace(/\s?AM/, " am").replace(/\s?PM/, " pm");
  function updateLocalTimes() {
    if (IN_INDIA) { timeHint.textContent = ""; return; }
    // the same IST window on the chosen day (or today), shown in the visitor's own time
    const day = F.date.value || new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
    const at = (h) => new Date(Date.parse(day + "T00:00:00Z") + (h * 60 - 330) * 60000);
    $$(".choice-local", form).forEach((el) => {
      const [a, b] = SLOT_HOURS[el.dataset.slot];
      el.textContent = T.yourTime(fmtTime(at(a)), fmtTime(at(b)));
    });
    timeHint.textContent = T.timeLocal(TZ.split("/").pop().replace(/_/g, " "));
  }

  // a draft survives a reload or a trip to WhatsApp and back, for this tab only
  const DRAFT = "vs-booking-draft-v2";
  const draft = {
    get() { try { return JSON.parse(sessionStorage.getItem(DRAFT) || "null"); } catch (e) { return null; } },
    set(v) { try { sessionStorage.setItem(DRAFT, JSON.stringify(v)); } catch (e) {} },
    clear() { try { sessionStorage.removeItem(DRAFT); } catch (e) {} },
  };
  const read = () => ({
    name: F.name.value.trim(), phone: F.phone.value.trim(), email: F.email.value.trim(),
    service: F.service.value, country: F.country.value, language: F.language.value,
    date: F.date.value, time: F.time.value || "any", message: F.message.value.trim(), website: F.website.value,
  });

  // no requests for days already gone (local calendar day)
  const now = new Date();
  F.date.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dayOf = (iso) => new Date(iso + "T12:00:00");
  const niceDay = (iso) => dayOf(iso).toLocaleDateString(T.dateLocale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  // what the visitor sees for a choice, in the page's language
  const choiceText = (name, value) => {
    const input = $$(`input[name="${name}"]`, form).find((i) => i.value === value);
    const label = input && input.closest(".choice");
    if (!label) return value;
    const title = label.querySelector(".choice-title").textContent.trim();
    const hint = name === "time" && value !== "any" ? label.querySelector(".choice-hint").textContent.trim() : "";
    return hint ? `${title}, ${hint} IST` : title;
  };
  const countryText = () => F.country.selectedOptions[0]?.textContent.trim() || F.country.value;

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

  const phoneOk = (p) => /^[+\d][\d\s()-]*$/.test(p) && p.replace(/\D/g, "").length >= 8 && p.replace(/\D/g, "").length <= 15;
  const RULES = {
    name: (v) => (v.name.length >= 2 ? "" : T.errName),
    phone: (v) => (!v.phone || phoneOk(v.phone) ? "" : T.errPhone),
    email: (v) => (!v.email || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email) ? "" : T.errEmail),
    contact: (v) => (v.phone || v.email ? "" : T.errContact),
    service: (v) => (v.service ? "" : T.errService),
    date: (v) => (!v.date || v.date >= F.date.min ? "" : T.errDate),
  };
  const ERR = { name: T.errName, phone: T.errPhone, email: T.errEmail, contact: T.errContact, service: T.errService, date: T.errDate };
  const isShown = (n) => !document.getElementById("e-" + n).hidden;
  function showError(name, msg) {
    const box = document.getElementById("e-" + name);
    box.querySelector("span").textContent = msg;
    box.hidden = !msg;
    const targets = name === "service" ? $$('input[name="service"]', form) : name === "contact" ? [F.phone, F.email] : [F[name]];
    targets.forEach((t) => {
      // phone and email stay marked while their own error or the shared "one of these" error shows
      const bad = t.type === "radio" ? !!msg : isShown(t.name) || ((t.name === "phone" || t.name === "email") && isShown("contact"));
      if (bad) t.setAttribute("aria-invalid", "true"); else t.removeAttribute("aria-invalid");
    });
  }
  const check = (name, v = read()) => { const msg = RULES[name](v); showError(name, msg); return !msg; };

  function updateDateHint() {
    const iso = F.date.value;
    let hint = "";
    if (iso && iso >= F.date.min) {
      const wd = dayOf(iso).getDay();
      if (wd === 0) hint = T.hintSun;
      else if (wd === 6) hint = T.hintSat;
    }
    dateHint.textContent = hint;
  }

  function message(v, ref) {
    return [
      T.msgHello,
      "",
      ref ? `${T.fRef}: ${ref}` : null,
      `${T.fName}: ${v.name}`,
      `${T.fSession}: ${choiceText("service", v.service)}`,
      v.date ? `${T.fDay}: ${niceDay(v.date)}` : null,
      v.time && v.time !== "any" ? `${T.fTime}: ${choiceText("time", v.time)}` : null,
      `${T.fCountry}: ${countryText()}`,
      `${T.fLang}: ${choiceText("language", v.language)}`,
      v.phone ? `${T.fPhone}: ${v.phone}` : null,
      v.email ? `${T.fEmail}: ${v.email}` : null,
      v.message ? `\n${T.fMsg}: ${v.message}` : null,
    ].filter((l) => l !== null).join("\n");
  }
  const mailto = (v, ref) => `mailto:${MAIL}?subject=${encodeURIComponent(T.subject(v.name) + (ref ? ` (${ref})` : ""))}&body=${encodeURIComponent(message(v, ref))}`;

  let saveT;
  const saveDraft = () => { clearTimeout(saveT); saveT = setTimeout(() => { const { website, ...v } = read(); draft.set(v); }, 250); };

  // start from the visitor's country and language, then restore a draft from earlier in this tab
  defaults();
  const saved = draft.get();
  if (saved) {
    ["name", "phone", "email", "date", "message", "country"].forEach((k) => { if (saved[k]) F[k].value = saved[k]; });
    ["service", "language", "time"].forEach((k) => {
      const r = $$(`input[name="${k}"]`, form).find((i) => i.value === saved[k]);
      if (r) r.checked = true;
    });
    updateDateHint();
  }
  syncChoices();
  updateLocalTimes();

  // fix errors as people type; check a field when they leave it, once it has something in it
  form.addEventListener("input", (e) => {
    const n = e.target.name;
    if (RULES[n] && e.target.getAttribute("aria-invalid") === "true") check(n);
    if ((n === "phone" || n === "email") && !document.getElementById("e-contact").hidden) check("contact");
    saveDraft();
  });
  form.addEventListener("change", (e) => {
    const n = e.target.name;
    if (n === "service" || n === "time" || n === "language") { syncChoices(); if (n === "service") showError("service", ""); }
    if (n === "date") { updateDateHint(); check("date"); updateLocalTimes(); }
    saveDraft();
  });
  form.addEventListener("focusout", (e) => {
    const n = e.target.name;
    if ((n === "phone" || n === "email") && e.target.value.trim()) check(n);
  });
  mailAlt.addEventListener("click", () => { mailAlt.href = mailto(read()); });
  waAlt.addEventListener("click", () => { waAlt.href = WA + encodeURIComponent(message(read())); });

  /* optional Cloudflare Turnstile: loads on first interaction, only when a site key is set */
  let tsWidget = null, tsReady = null;
  function loadTurnstile() {
    if (!SITEKEY || tsReady) return tsReady;
    const box = document.createElement("div");
    box.id = "ts-box";
    form.querySelector(".form-actions").before(box);
    tsReady = new Promise((resolve) => {
      window.vsTurnstileLoad = () => {
        try { tsWidget = window.turnstile.render(box, { sitekey: SITEKEY, theme: "light", appearance: "interaction-only", language: PAGE_LANG }); } catch (e) {}
        resolve();
      };
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=vsTurnstileLoad";
      s.async = true;
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
    return tsReady;
  }
  async function turnstileToken() {
    if (!SITEKEY) return "";
    await loadTurnstile();
    if (tsWidget === null || !window.turnstile) return "";
    let t = window.turnstile.getResponse(tsWidget) || "";
    for (let i = 0; i < 40 && !t; i++) { await new Promise((r) => setTimeout(r, 200)); t = window.turnstile.getResponse(tsWidget) || ""; }
    return t;
  }
  if (SITEKEY && ENDPOINT) form.addEventListener("focusin", loadTurnstile, { once: true });

  let sending = false, lastText = "", lastValues = null, doneKind = "";
  function setLoading(on, label) {
    sending = on;
    submitBtn.classList.toggle("is-loading", on);
    submitBtn.setAttribute("aria-disabled", String(on));
    submitBtn.toggleAttribute("aria-busy", on);
    submitLabel.textContent = on ? label : T.send;
  }

  async function sendToServer(v) {
    const token = await turnstileToken();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, timezone: TZ, locale: PAGE_LANG, turnstileToken: token, ...(TEST_MODE ? { test: true } : {}) }),
        signal: ctrl.signal,
      });
      const out = await res.json().catch(() => ({}));
      if (res.status === 201 && out.ref) return { kind: "sent", ref: out.ref, test: !!out.test };
      if (res.status === 422 && out.fields) return { kind: "invalid", fields: out.fields };
      return { kind: "failed", reason: res.status === 429 ? "rate" : "error" };
    } catch (e) {
      return { kind: "failed", reason: "error" };
    } finally {
      clearTimeout(timer);
      if (tsWidget !== null && window.turnstile) { try { window.turnstile.reset(tsWidget); } catch (e) {} }
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (sending) return;
    const v = read();
    let first = null;
    for (const n of ["name", "phone", "email", "contact", "service", "date"]) {
      if (!check(n, v) && !first) first = n === "service" ? $('input[name="service"]', form) : n === "contact" ? F.phone : F[n];
    }
    if (first) { first.focus(); return; }
    lastValues = v;
    lastText = message(v);

    if (!ENDPOINT) {
      // no booking function configured: open WhatsApp synchronously inside the click so pop-up blockers allow it
      setLoading(true, T.opening);
      const url = WA + encodeURIComponent(lastText);
      let win = null;
      if (!recording) { try { win = window.open(url, "_blank"); if (win) win.opener = null; } catch (err) { win = null; } }
      setTimeout(() => { setLoading(false); showDone({ kind: "whatsapp", opened: !!win || recording }); }, 300);
      return;
    }

    setLoading(true, T.sending);
    const result = await sendToServer(v);
    setLoading(false);
    if (result.kind === "invalid") {
      // the server's rules match these; show what it caught
      let firstBad = null;
      for (const n of ["name", "phone", "email", "contact", "service", "date"]) {
        if (!result.fields[n]) continue;
        showError(n, RULES[n](v) || ERR[n]);
        if (!firstBad) firstBad = n === "contact" ? F.phone : n === "service" ? $('input[name="service"]', form) : F[n];
      }
      (firstBad || F.name).focus();
      return;
    }
    showDone(result);
  });

  const doneH = document.getElementById("done-h");
  const doneMsg = document.getElementById("done-msg");
  const doneRef = document.getElementById("done-ref");
  const doneOpen = document.getElementById("done-open");
  const doneCopy = document.getElementById("done-copy");
  const doneEdit = document.getElementById("done-edit");
  const doneStatus = document.getElementById("done-status");
  const doneMailNote = document.getElementById("done-mail-note");
  const setLabel = (btn, text) => { btn.querySelector(".btn-label").textContent = text; };

  function showDone(result) {
    const v = lastValues;
    doneKind = result.kind;
    // fx.js stamps a saved request with a seal; anything else shows the plain mark
    window.dispatchEvent(new CustomEvent(result.kind === "sent" ? "vs:sent" : "vs:unsealed", { detail: { ref: result.ref } }));
    done.classList.toggle("blocked", result.kind === "whatsapp" && !result.opened);
    done.classList.toggle("failed", result.kind === "failed");
    doneRef.hidden = result.kind !== "sent";
    doneMailNote.hidden = result.kind === "sent";
    if (result.kind === "sent") {
      lastText = message(v, result.ref);
      document.getElementById("done-ref-code").textContent = result.ref;
      doneH.textContent = T.sentH;
      doneMsg.textContent = result.test ? T.testMsg : T.sentMsg;
      doneOpen.href = WA + encodeURIComponent(T.msgAfter(result.ref));
      setLabel(doneOpen, T.sentOpen);
      setLabel(doneEdit, T.another);
    } else if (result.kind === "failed") {
      doneH.textContent = T.failH;
      doneMsg.textContent = result.reason === "rate" ? T.rateMsg : T.failMsg;
      doneOpen.href = WA + encodeURIComponent(lastText);
      setLabel(doneOpen, T.openWa);
      setLabel(doneEdit, T.edit);
    } else {
      doneH.textContent = result.opened ? T.waH : T.waBlockedH;
      doneMsg.textContent = result.opened ? T.waMsg : T.waBlockedMsg;
      doneOpen.href = WA + encodeURIComponent(lastText);
      setLabel(doneOpen, result.opened ? T.openWaAgain : T.openWa);
      setLabel(doneEdit, T.edit);
    }
    document.getElementById("done-summary").textContent = lastText;
    document.getElementById("done-mail").href = mailto(v);
    doneStatus.textContent = "";
    form.hidden = true;
    done.hidden = false;
    // a saved request is finished with; one that still has to be sent keeps its draft
    if (result.kind !== "failed") { clearTimeout(saveT); draft.clear(); }
    focusQuietly(doneH);
    ScrollTrigger.refresh();
  }
  function showForm(focus = true) {
    done.hidden = true;
    form.hidden = false;
    ScrollTrigger.refresh();
    if (focus) F.name.focus({ preventScroll: false });
  }
  doneEdit.addEventListener("click", () => {
    if (doneKind === "sent") {
      // a fresh form for a new request; keep who they are and where they live
      const keep = { name: F.name.value, phone: F.phone.value, email: F.email.value, country: F.country.value };
      form.reset();
      defaults();
      F.name.value = keep.name; F.phone.value = keep.phone; F.email.value = keep.email; F.country.value = keep.country;
      ["name", "phone", "email", "contact", "service", "date"].forEach((n) => showError(n, ""));
      updateDateHint(); updateLocalTimes(); syncChoices();
    }
    showForm(true);
  });

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
    clearTimeout(copyT);
    if (ok) {
      setLabel(doneCopy, T.copied);
      doneStatus.textContent = T.copyOk;
      copyT = setTimeout(() => setLabel(doneCopy, T.copy), 2400);
    } else {
      doneStatus.textContent = T.copyFail;
    }
  });
})();
