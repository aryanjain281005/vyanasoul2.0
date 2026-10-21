/* Vyana Soul — the Akashic library in real-time 3D.
   Scroll moves the camera through five scenes; the pointer looks around,
   stirs the gold dust, pulls books from the shelves and turns the pages. */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";


/* ------------------------------------------------------------------ utils */
function mulberry(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = mulberry(369);
const rand = (a, b) => a + (b - a) * R();
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function noiseSpeckle(g, w, h, n, alpha, light) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = light ? `rgba(255,240,220,${alpha * R()})` : `rgba(0,0,0,${alpha * R()})`;
    g.fillRect(R() * w, R() * h, 1 + R() * 3, 1 + R() * 3);
  }
}

/* ------------------------------------------------------------------ boot */
function boot() {
  const VS = window.VS || {};
  const recording = !!VS.recording;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const phone = coarse && Math.min(innerWidth, innerHeight) < 820;
  const Q = phone
    ? { dpr: Math.min(devicePixelRatio || 1, 1.4), zMin: -21, levels: 13, dust: 1300, vortex: 16000, stars: 1600, candles: 40, lights: 4, aa: false }
    : { dpr: Math.min(devicePixelRatio || 1, 1.75), zMin: -29, levels: 17, dust: 3400, vortex: 40000, stars: 3600, candles: 86, lights: 7, aa: true };

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(Q.dpr);
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x07050d);
  const FOG = new THREE.Color(0x0c0814);
  scene.background = BG.clone();
  scene.fog = new THREE.FogExp2(FOG.clone(), 0.05);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.05, 500);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(Q.dpr);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.62, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // world-size point sprites: pixels per metre at distance 1
  const pointUniforms = { uPx: { value: 1 }, uTime: { value: 0 } };
  function updatePx() {
    const h = renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    pointUniforms.uPx.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  }

  /* ------------------------------------------------------------ textures */
  const spineMap = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = "#d9d1c6"; g.fillRect(0, 0, w, h);
    noiseSpeckle(g, w, h, 900, 0.10, false);
    noiseSpeckle(g, w, h, 300, 0.06, true);
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, "rgba(0,0,0,0.55)"); grd.addColorStop(0.25, "rgba(0,0,0,0.05)");
    grd.addColorStop(0.7, "rgba(0,0,0,0.05)"); grd.addColorStop(1, "rgba(0,0,0,0.6)");
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(0,0,0,0.28)"; g.fillRect(0, h * 0.27, w, h * 0.15);
  });
  const spineGlow = canvasTex(64, 256, (g, w, h) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    for (const y of [0.07, 0.105, 0.895, 0.93]) g.fillRect(0, h * y, w, h * 0.012);
    for (const y of [0.30, 0.34, 0.38]) g.fillRect(w * 0.2, h * y, w * 0.6, h * 0.006);
  });
  const woodMap = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#6a4a33"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(${20 + R() * 30},${10 + R() * 15},5,${0.08 + R() * 0.15})`;
      g.lineWidth = 0.5 + R() * 2;
      g.beginPath();
      const y = R() * h;
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.03 + i) * 3);
      g.stroke();
    }
    noiseSpeckle(g, w, h, 600, 0.08, false);
  }, { repeat: [1, 1] });
  const floorMap = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#2e2a33"; g.fillRect(0, 0, w, h);
    const s = 128;
    for (let y = 0; y < h; y += s) for (let x = 0; x < w; x += s) {
      const v = 38 + R() * 18;
      g.fillStyle = `rgb(${v},${v - 4},${v + 4})`;
      g.fillRect(x + 3, y + 3, s - 6, s - 6);
    }
    noiseSpeckle(g, w, h, 4000, 0.12, false);
  }, { repeat: [3, 30] });
  const rugMap = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = "#4a0f12"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#8a6a2c";
    g.fillRect(14, 0, 6, h); g.fillRect(w - 20, 0, 6, h);
    g.fillRect(28, 0, 2, h); g.fillRect(w - 30, 0, 2, h);
    g.strokeStyle = "rgba(160,120,50,0.5)"; g.lineWidth = 2;
    for (let y = 32; y < h; y += 64) {
      g.beginPath(); g.moveTo(w / 2, y - 26); g.lineTo(w / 2 + 40, y); g.lineTo(w / 2, y + 26); g.lineTo(w / 2 - 40, y); g.closePath(); g.stroke();
    }
    noiseSpeckle(g, w, h, 2500, 0.12, false);
  }, { repeat: [1, 14] });
  const glowTex = canvasTex(128, 128, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.2, "rgba(255,220,170,0.6)");
    grd.addColorStop(0.5, "rgba(255,170,90,0.15)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  const raysTex = canvasTex(512, 512, (g, w) => {
    g.translate(w / 2, w / 2);
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + R() * 0.05;
      const len = w * (0.28 + R() * 0.22);
      const wd = 0.004 + R() * 0.012;
      g.fillStyle = `rgba(255,${200 + R() * 40},${130 + R() * 60},${0.05 + R() * 0.12})`;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a - wd) * len, Math.sin(a - wd) * len); g.lineTo(Math.cos(a + wd) * len, Math.sin(a + wd) * len); g.closePath(); g.fill();
    }
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    grd.addColorStop(0, "rgba(255,250,235,1)"); grd.addColorStop(0.08, "rgba(255,225,170,0.7)");
    grd.addColorStop(0.3, "rgba(255,170,80,0.12)"); grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd; g.fillRect(-w / 2, -w / 2, w, w);
  });

  const WORDS = ["आकाश", "अभिलेख", "आत्मा", "प्रकाश", "सत्य", "शान्ति", "कर्म", "धर्म", "प्रेम", "उपचार", "स्पष्टता", "ज्ञान", "चेतना", "मार्ग", "अनन्त", "स्मृति", "श्रद्धा", "करुणा", "प्राण", "मुक्ति", "हृदय", "जीवन"];
  function drawPages(g, w, h) {
    for (let side = 0; side < 2; side++) {
      const x0 = side * (w / 2);
      g.fillStyle = "#eadcbf"; g.fillRect(x0, 0, w / 2, h);
      for (let i = 0; i < 30; i++) {
        const cx = x0 + R() * (w / 2), cy = R() * h, r = 40 + R() * 160;
        const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r);
        grd.addColorStop(0, "rgba(170,130,70,0.10)"); grd.addColorStop(1, "rgba(170,130,70,0)");
        g.fillStyle = grd; g.fillRect(x0, 0, w / 2, h);
      }
      const edge = g.createLinearGradient(x0, 0, x0 + w / 2, 0);
      if (side === 0) { edge.addColorStop(0, "rgba(90,60,20,0.35)"); edge.addColorStop(0.1, "rgba(0,0,0,0)"); edge.addColorStop(0.92, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(60,40,10,0.45)"); }
      else { edge.addColorStop(0, "rgba(60,40,10,0.45)"); edge.addColorStop(0.08, "rgba(0,0,0,0)"); edge.addColorStop(0.9, "rgba(0,0,0,0)"); edge.addColorStop(1, "rgba(90,60,20,0.35)"); }
      g.fillStyle = edge; g.fillRect(x0, 0, w / 2, h);
      const mx = x0 + (side === 0 ? 120 : 110), mw = w / 2 - 230;
      g.fillStyle = "#a8782e";
      g.font = `96px "Tiro Devanagari Sanskrit", serif`;
      g.fillText(side === 0 ? "ॐ" : "श्री", mx, 190);
      g.fillStyle = "rgba(58,38,20,0.88)";
      g.font = `38px "Tiro Devanagari Sanskrit", serif`;
      let y = side === 0 ? 300 : 280;
      while (y < h - 110) {
        let x = mx, line = "";
        const indent = R() < 0.15 ? 60 : 0;
        x += indent;
        while (true) {
          const wd = WORDS[(R() * WORDS.length) | 0] + " ";
          if (g.measureText(line + wd).width > mw - indent) break;
          line += wd;
        }
        if (R() < 0.12) line = line.slice(0, line.length * 0.6);
        g.fillText(line, x, y);
        y += 62;
        if (R() < 0.12) y += 40;
      }
      g.strokeStyle = "rgba(168,120,46,0.6)"; g.lineWidth = 3;
      g.strokeRect(x0 + 70, 70, w / 2 - 140, h - 140);
    }
  }
  let pagesTex = canvasTex(1600, 1100, drawPages);
  if (document.fonts && document.fonts.load) {
    document.fonts.load('38px "Tiro Devanagari Sanskrit"', "आकाश").then(() => {
      const t = canvasTex(1600, 1100, drawPages);
      pageMat.map = t; pageMat.emissiveMap = t; pageMat.needsUpdate = true;
    }).catch(() => {});
  }

  /* ------------------------------------------------------------ library */
  const AISLE = 2.6, BACK = 3.2, BAY = 3.0, Z0 = 8.5, Z1 = -64, LEVEL_H = 0.44, BOARD = 0.035, BASE_Y = 0.34, TOP = 8.9;
  const LEN = Z0 - Z1, ZC = (Z0 + Z1) / 2;
  const wood = new THREE.MeshStandardMaterial({ map: woodMap, color: 0x8a6448, roughness: 0.78, metalness: 0 });
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  const structure = [];
  const addBox = (x, y, z, sx, sy, sz) => structure.push([x, y, z, sx, sy, sz]);
  for (const s of [-1, 1]) {
    addBox(s * (BACK + 0.05), TOP / 2, ZC, 0.1, TOP, LEN);
    for (let i = 0; i <= 19; i++) addBox(s * (AISLE + BACK) / 2, BASE_Y + i * LEVEL_H - BOARD / 2, ZC, BACK - AISLE, BOARD, LEN);
    addBox(s * (AISLE + BACK) / 2 - s * 0.03, BASE_Y / 2, ZC, BACK - AISLE + 0.06, BASE_Y, LEN);
    addBox(s * (AISLE + 0.22), TOP + 0.14, ZC, 0.95, 0.28, LEN);
    for (let z = Z0; z > Z1; z -= BAY) addBox(s * (AISLE + 0.06), (TOP + 0.3) / 2, z, 0.42, TOP + 0.3, 0.3);
  }
  const structMesh = new THREE.InstancedMesh(unitBox, wood, structure.length);
  structure.forEach(([x, y, z, sx, sy, sz], i) => {
    m4.compose(v3.set(x, y, z), q4.identity(), s3.set(sx, sy, sz));
    structMesh.setMatrixAt(i, m4);
  });
  scene.add(structMesh);

  const archGeo = new THREE.TorusGeometry(AISLE + 0.06, 0.12, 6, 36, Math.PI);
  const archZ = [];
  for (let z = Z0; z > Z1; z -= BAY) archZ.push(z);
  const arches = new THREE.InstancedMesh(archGeo, wood, archZ.length);
  archZ.forEach((z, i) => { m4.compose(v3.set(0, TOP + 0.3, z), q4.identity(), s3.set(1, 1.25, 1)); arches.setMatrixAt(i, m4); });
  scene.add(arches);

  const ceilMat = new THREE.MeshStandardMaterial({ color: 0x150f1c, roughness: 1, transparent: true, opacity: 1, depthWrite: true });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(9, LEN), ceilMat);
  ceiling.rotation.x = Math.PI / 2; ceiling.position.set(0, TOP + 0.3 + (AISLE + 0.06) * 1.25 + 0.15, ZC);
  scene.add(ceiling);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(BACK * 2 + 0.4, LEN), new THREE.MeshStandardMaterial({ map: floorMap, color: 0x9a8f9e, roughness: 0.55, metalness: 0.05 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, ZC);
  scene.add(floor);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.5, LEN), new THREE.MeshStandardMaterial({ map: rugMap, roughness: 0.95 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, ZC);
  scene.add(rug);

  /* --- books on the shelves --- */
  const PALETTE = [0x6e2018, 0x4a2a18, 0x7d5733, 0x2a3c30, 0x33294a, 0x56431f, 0x8a6236, 0x2a211c, 0x5c1d2b, 0x3c3a2a].map((c) => new THREE.Color(c));
  const bookData = [];            // per instance: {s, level, z0, z1, h, x, y, z, t, d, lean, color}
  const rows = new Map();         // key s|level -> sorted array of instance ids (by z desc)
  for (const s of [-1, 1]) {
    for (let level = 0; level < Q.levels; level++) {
      const baseY = BASE_Y + level * LEVEL_H;
      const row = [];
      for (let zBay = Z0; zBay > Q.zMin; zBay -= BAY) {
        let z = zBay - 0.17;
        const end = zBay - BAY + 0.17;
        while (z > end) {
          if (R() < 0.035) { z -= rand(0.06, 0.24); continue; }
          const t = rand(0.034, 0.085);
          if (z - t < end) break;
          const h = rand(0.25, 0.375) * (R() < 0.08 ? 0.82 : 1);
          const d = rand(0.19, 0.28);
          const lean = R() < 0.05 ? rand(-0.22, 0.22) : 0;
          const c = PALETTE[(R() * PALETTE.length) | 0].clone().multiplyScalar(rand(0.65, 1.15));
          const id = bookData.length;
          bookData.push({ s, level, z0: z, z1: z - t, h, d, t, lean, c, x: s * (AISLE + d / 2 + rand(0, 0.035)), y: baseY + h / 2, z: z - t / 2 });
          row.push(id);
          z -= t + (lean ? 0.03 : 0.002);
        }
      }
      rows.set(`${s}|${level}`, row);
    }
  }
  const bookMat = new THREE.MeshStandardMaterial({ map: spineMap, roughness: 0.62, metalness: 0.05, emissive: 0xc8913a, emissiveMap: spineGlow, emissiveIntensity: 0.32 });
  const books = new THREE.InstancedMesh(unitBox, bookMat, bookData.length);
  const eLean = new THREE.Euler();
  function bookMatrix(b, pull) {
    eLean.set(b.lean, 0, 0);
    q4.setFromEuler(eLean);
    m4.compose(v3.set(b.x - b.s * pull, b.y - (b.lean ? Math.abs(b.lean) * 0.02 : 0), b.z), q4, s3.set(b.d, b.h, b.t));
    return m4;
  }
  bookData.forEach((b, i) => { books.setMatrixAt(i, bookMatrix(b, 0)); books.setColorAt(i, b.c); });
  books.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(books);

  /* --- candles --- */
  const candleGeo = new THREE.CylinderGeometry(0.032, 0.036, 1, 10);
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xefe2cc, emissive: 0xffc88a, emissiveIntensity: 0.35, roughness: 0.5 });
  const candles = [];
  for (let i = 0; i < Q.candles; i++) {
    const side = R() < 0.5 ? -1 : 1;
    candles.push({ x: side * rand(0.7, 2.2), y: rand(2.7, 8.2), z: rand(Q.zMin + 2, 6.5), h: rand(0.12, 0.28), ph: R() * 6.28, float: true });
  }
  for (let z = Z0 - BAY; z > Q.zMin; z -= BAY) for (const s of [-1, 1]) {
    candles.push({ x: s * (AISLE - 0.16), y: 2.28, z, h: 0.16, ph: R() * 6.28, float: false });
    if (R() < 0.6) candles.push({ x: s * (AISLE - 0.16), y: 5.4, z: z - 0.02, h: 0.14, ph: R() * 6.28, float: false });
  }
  candles.push({ x: -0.62, y: 1.08, z: 1.35, h: 0.2, ph: 1, float: false }, { x: 0.66, y: 1.08, z: 1.3, h: 0.26, ph: 2, float: false });
  const candleMesh = new THREE.InstancedMesh(candleGeo, candleMat, candles.length);
  scene.add(candleMesh);
  const flamePos = new Float32Array(candles.length * 3), flameSeed = new Float32Array(candles.length);
  candles.forEach((c, i) => { flameSeed[i] = R(); });
  const flameGeo = new THREE.BufferGeometry();
  flameGeo.setAttribute("position", new THREE.BufferAttribute(flamePos, 3).setUsage(THREE.DynamicDrawUsage));
  flameGeo.setAttribute("aSeed", new THREE.BufferAttribute(flameSeed, 1));
  const flameMat = new THREE.ShaderMaterial({
    uniforms: pointUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `uniform float uPx, uTime; attribute float aSeed; varying float vF;
      void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv;
        vF = 0.82 + 0.18*sin(uTime*11.0 + aSeed*40.0) * sin(uTime*7.3 + aSeed*13.0);
        gl_PointSize = 0.34 * vF * uPx / -mv.z; }`,
    fragmentShader: `varying float vF;
      void main(){ vec2 uv = gl_PointCoord*2.0-1.0; uv.y += 0.25;
        float d = length(vec2(uv.x*2.3, uv.y*(uv.y>0.0?1.0:1.7)));
        float core = exp(-d*d*9.0); float halo = exp(-length(uv)*3.2)*0.35;
        vec3 c = mix(vec3(1.0,0.42,0.12), vec3(1.0,0.86,0.58), core);
        gl_FragColor = vec4(c*(core*3.2 + halo)*vF, 1.0); }`,
  });
  const flames = new THREE.Points(flameGeo, flameMat);
  flames.frustumCulled = false;
  scene.add(flames);
  function updateCandles(t) {
    candles.forEach((c, i) => {
      const y = c.y + (c.float ? Math.sin(t * 0.7 + c.ph) * 0.07 : 0);
      m4.compose(v3.set(c.x, y, c.z), q4.identity(), s3.set(1, c.h, 1));
      candleMesh.setMatrixAt(i, m4);
      flamePos[i * 3] = c.x; flamePos[i * 3 + 1] = y + c.h / 2 + 0.045; flamePos[i * 3 + 2] = c.z;
    });
    candleMesh.instanceMatrix.needsUpdate = true;
    flameGeo.attributes.position.needsUpdate = true;
  }

  /* --- lights --- */
  scene.add(new THREE.HemisphereLight(0x3b3366, 0x24160c, 0.55));
  const keyLight = new THREE.PointLight(0xffb070, 9, 0, 2);
  keyLight.position.set(1.1, 2.6, 2.6);
  scene.add(keyLight);
  const aisleLights = [];
  for (let i = 0; i < Q.lights - 1; i++) {
    const L = new THREE.PointLight(0xff9a50, 14, 0, 2);
    L.position.set((i % 2 ? 1 : -1) * 1.9, 2.7 + (i % 3) * 0.8, 4.5 - i * 4.6);
    scene.add(L); aisleLights.push(L);
  }
  const skyLight = new THREE.DirectionalLight(0x8e7cff, 0);
  skyLight.position.set(0, 20, -8);
  scene.add(skyLight);

  /* ------------------------------------------------------------ the book */
  const PW = 0.6, PD = 0.84;
  const book = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x4f1512, roughness: 0.5, metalness: 0.1 });
  const paperEdge = new THREE.MeshStandardMaterial({ color: 0xd6c39b, roughness: 0.9 });
  const pageMat = new THREE.MeshStandardMaterial({ map: pagesTex, roughness: 0.88, emissive: 0xffd9a8, emissiveMap: pagesTex, emissiveIntensity: 0.03, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const cover = new THREE.Mesh(unitBox, leather);
    cover.scale.set(PW + 0.05, 0.022, PD + 0.06); cover.position.set(s * (PW + 0.05) / 2, 0, 0);
    const block = new THREE.Mesh(unitBox, paperEdge);
    block.scale.set(PW - 0.01, 0.05, PD); block.position.set(s * (PW / 2), 0.035, 0);
    book.add(cover, block);
  }
  const spine = new THREE.Mesh(unitBox, leather);
  spine.scale.set(0.05, 0.03, PD + 0.06); spine.position.y = -0.004; book.add(spine);
  const profile = (u) => 0.066 + 0.042 * (1 - Math.exp(-7 * u)) - 0.012 * u * u;
  function pageGeometry(side) {
    const g = new THREE.PlaneGeometry(PW, PD, 28, 2);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const u = (pos.getX(i) + PW / 2) / PW;            // 0..1 across the page
      const uu = side < 0 ? 1 - u : u;                  // distance from spine
      pos.setX(i, side * uu * PW);
      pos.setY(i, profile(uu));
      uv.setX(i, side < 0 ? u * 0.5 : 0.5 + u * 0.5);
    }
    g.computeVertexNormals();
    return g;
  }
  const pageL = new THREE.Mesh(pageGeometry(-1), pageMat);
  const pageR = new THREE.Mesh(pageGeometry(1), pageMat);
  book.add(pageL, pageR);
  const turnGeo = pageGeometry(1);
  const turnBase = Float32Array.from(turnGeo.attributes.position.array);
  const turnPage = new THREE.Mesh(turnGeo, pageMat);
  book.add(turnPage);
  function setTurn(theta) {
    const pos = turnGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = Math.max(0, turnBase[i * 3] / PW);
      const a = theta + 0.55 * Math.sin(theta) * Math.pow(u, 1.5);
      const r = u * PW;
      const lift = profile(u) * Math.abs(Math.cos(theta));
      pos.setX(i, Math.cos(a) * r);
      pos.setY(i, lift + Math.sin(a) * r + 0.003 + 0.06 * Math.sin(theta) * u * (1 - u));
      pos.setZ(i, turnBase[i * 3 + 2]);
    }
    pos.needsUpdate = true;
    turnGeo.computeVertexNormals();
  }
  setTurn(0);
  const bookLight = new THREE.PointLight(0xffc98a, 0, 0, 2);
  bookLight.position.set(0, 0.65, 0.15);
  book.add(bookLight);
  const rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: raysTex, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  rays.position.set(0, 0.12, 0); book.add(rays);
  const coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe2b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  coreGlow.position.set(0, 0.1, 0); book.add(coreGlow);
  scene.add(book);

  // lectern
  const lectern = new THREE.Group();
  const post = new THREE.Mesh(unitBox, wood); post.scale.set(0.24, 0.92, 0.24); post.position.y = 0.46;
  const foot = new THREE.Mesh(unitBox, wood); foot.scale.set(0.7, 0.08, 0.55); foot.position.y = 0.04;
  const top = new THREE.Mesh(unitBox, wood); top.scale.set(1.45, 0.05, 1.0); top.position.y = 0.98; top.rotation.x = 0.42;
  lectern.add(post, foot, top);
  lectern.position.set(0, 0, 1.0);
  scene.add(lectern);
  const BOOK_A = new THREE.Vector3(0, 1.035, 1.0), BOOK_B = new THREE.Vector3(0, 2.55, -6.0);

  /* ------------------------------------------------------------ sky */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(160, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uReveal: { value: 0 }, uTime: pointUniforms.uTime, uBg: { value: BG.clone() } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uReveal, uTime; uniform vec3 uBg; varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z); }
      float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){ vec3 d = normalize(vDir);
        float up = smoothstep(-0.1, 0.45, d.y);
        float n = fbm(d*2.6 + vec3(0.0, uTime*0.003, 0.0));
        float n2 = fbm(d*5.0 + 3.7);
        vec3 neb = mix(vec3(0.24,0.12,0.48), vec3(0.08,0.16,0.30), smoothstep(0.35,0.75,n2));
        vec3 col = vec3(0.014,0.010,0.034) + neb*pow(smoothstep(0.34,0.84,n),2.0)*2.0;
        col += vec3(1.0,0.72,0.42)*pow(smoothstep(0.55,0.95,n*n2*1.7),3.0)*0.5;
        vec3 g = d*380.0; vec3 id = floor(g); float h = hash(id);
        float star = step(0.9962, h)*smoothstep(0.5, 0.05, length(fract(g)-0.5))*(0.55+0.45*sin(uTime*1.7+h*90.0));
        col += vec3(1.0,0.95,0.88)*star*3.0;
        gl_FragColor = vec4(mix(uBg, col, uReveal*up), 1.0); }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);

  /* ------------------------------------------------------------ dust */
  {
    const n = Q.dust;
    const pos = new Float32Array(n * 3), seed = new Float32Array(n), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-2.4, 2.4); pos[i * 3 + 1] = rand(0.2, 8.6); pos[i * 3 + 2] = rand(Q.zMin, 7.5);
      seed[i] = R(); size[i] = R() < 0.06 ? rand(0.03, 0.06) : rand(0.008, 0.022);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    var dustUniforms = { ...pointUniforms, uMouse: { value: new THREE.Vector2(9, 9) }, uPush: { value: 1 }, uSpeed: { value: 1 } };
    const dust = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: dustUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uPx, uTime, uPush, uSpeed; uniform vec2 uMouse; attribute float aSeed, aSize; varying float vA;
        void main(){ vec3 p = position; float t = uTime*uSpeed;
          p.y = mod(p.y + t*(0.04 + 0.07*aSeed) - 0.2, 8.4) + 0.2;
          p.x += sin(t*0.27 + aSeed*20.0)*0.22; p.z += cos(t*0.21 + aSeed*13.0)*0.22;
          vec4 mv = modelViewMatrix*vec4(p, 1.0);
          vec4 cp = projectionMatrix*mv; vec2 ndc = cp.xy/cp.w;
          vec2 dd = (ndc - uMouse)*vec2(1.7, 1.0); float L = length(dd);
          float push = smoothstep(0.42, 0.0, L)*uPush;
          mv.xy += normalize(dd + 1e-4)*push*(-mv.z)*0.16;
          gl_Position = projectionMatrix*mv;
          float tw = 0.55 + 0.45*sin(uTime*1.8 + aSeed*40.0);
          gl_PointSize = max(1.2, aSize*uPx/-mv.z);
          vA = tw*smoothstep(0.15, 1.0, -mv.z)*(1.0 - smoothstep(12.0, 22.0, -mv.z))*(1.0 + push*1.5); }`,
      fragmentShader: `varying float vA;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float a = exp(-dot(uv,uv)*30.0)*vA;
          gl_FragColor = vec4(vec3(1.0,0.78,0.45)*a*1.8, 1.0); }`,
    }));
    dust.frustumCulled = false;
    scene.add(dust);
  }

  /* ------------------------------------------------------------ vortex / galaxy */
  // particles stream inward along silk-like strands on five spiral arms
  const vortexU = { ...pointUniforms, uAmount: { value: 0 }, uTilt: { value: 0 }, uScale: { value: 2.2 }, uSpin: { value: 1 }, uViolet: { value: 0.3 }, uCenter: { value: new THREE.Vector3(0, 3.2, -3.6) } };
  {
    const n = Q.vortex;
    const aArm = new Float32Array(n), aStr = new Float32Array(n), aS0 = new Float32Array(n), aSd = new Float32Array(n);
    const strands = 14;
    for (let i = 0; i < n; i++) {
      aArm[i] = (R() * 5) | 0;
      aStr[i] = (((R() * strands) | 0) / (strands - 1) - 0.5) + (R() - 0.5) * 0.04;
      aS0[i] = R();
      aSd[i] = R();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aArm", new THREE.BufferAttribute(aArm, 1));
    g.setAttribute("aStr", new THREE.BufferAttribute(aStr, 1));
    g.setAttribute("aS0", new THREE.BufferAttribute(aS0, 1));
    g.setAttribute("aSd", new THREE.BufferAttribute(aSd, 1));
    const vortex = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: vortexU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uPx, uTime, uAmount, uTilt, uScale, uSpin, uViolet; uniform vec3 uCenter;
        attribute float aArm, aStr, aS0, aSd; varying vec3 vC; varying float vA;
        void main(){
          float s = fract(aS0 - uTime*0.045*uSpin);              // flows inward
          float form = smoothstep(aSd*0.55, aSd*0.55 + 0.45, uAmount);
          float r = (0.06 + 0.94*pow(s, 0.85))*uScale*(0.2 + 0.8*form);
          float ang = aArm*1.2566371 + aStr*(0.18 + 0.55*s) + s*5.2 + uTime*0.18*uSpin;
          vec3 p = vec3(cos(ang)*r, sin(ang)*r, (aSd - 0.5)*0.18*s*uScale);
          float t = uTilt*1.5707963;
          p = vec3(p.x, p.y*cos(t) - p.z*sin(t), p.y*sin(t) + p.z*cos(t));
          vec4 mv = modelViewMatrix*vec4(uCenter + p, 1.0);
          gl_Position = projectionMatrix*mv;
          gl_PointSize = max(1.2, (0.012 + 0.010*(1.0 - s))*uScale*uPx/-mv.z);
          vec3 gold = mix(vec3(1.0,0.74,0.38)*1.7, vec3(1.0,0.52,0.16)*1.1, smoothstep(0.05, 0.6, s));
          vC = mix(gold, vec3(0.62,0.48,1.0)*1.1, smoothstep(0.5, 1.0, s)*uViolet);
          float strandW = 1.0 - smoothstep(0.0, 0.5, abs(aStr))*0.55;
          vA = form*uAmount*smoothstep(0.0, 0.08, s)*(1.0 - smoothstep(0.82, 1.0, s))*strandW*(0.35 + 0.65*aSd)*0.34*(0.55 + 0.45*smoothstep(0.0, 0.35, s)); }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 uv = gl_PointCoord - 0.5; float a = exp(-dot(uv,uv)*18.0)*vA;
          gl_FragColor = vec4(vC*a, 1.0); }`,
    }));
    vortex.frustumCulled = false;
    scene.add(vortex);
  }

  /* ------------------------------------------------------------ falling stars */
  const starsU = { ...pointUniforms, uAmount: { value: 0 }, uFrom: { value: new THREE.Vector3() }, uTo: { value: new THREE.Vector3() }, uScale: { value: 6 } };
  {
    const n = Q.stars, TR = 5;
    const st = new Float32Array(n * TR * 3), sd = new Float32Array(n * TR), tr = new Float32Array(n * TR);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, r = Math.sqrt(R()) * 0.6, seed = R();
      for (let k = 0; k < TR; k++) {
        const j = i * TR + k;
        st[j * 3] = Math.cos(a) * r; st[j * 3 + 1] = 0; st[j * 3 + 2] = Math.sin(a) * r;
        sd[j] = seed; tr[j] = k / (TR - 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(st, 3));
    g.setAttribute("aS", new THREE.BufferAttribute(sd, 1));
    g.setAttribute("aTr", new THREE.BufferAttribute(tr, 1));
    const fall = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: starsU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `uniform float uPx, uTime, uAmount, uScale; uniform vec3 uFrom, uTo; attribute float aS, aTr; varying float vA; varying float vHead;
        void main(){
          float life = fract(uTime*0.08 + aS) - aTr*0.022;
          vec3 s = uFrom + position*uScale;
          vec3 e = uTo + vec3(sin(aS*50.0)*0.2, 0.04, cos(aS*31.0)*0.12);
          float l = clamp(life, 0.0, 1.0);
          float k = l*l*(3.0 - 2.0*l);
          vec3 p = mix(s, e, k);
          p.x += sin(l*3.14159)*sin(aS*20.0)*0.9; p.z += sin(l*3.14159)*cos(aS*17.0)*0.5;
          vec4 mv = modelViewMatrix*vec4(p, 1.0); gl_Position = projectionMatrix*mv;
          vHead = 1.0 - aTr;
          float big = step(0.88, fract(aS*7.13));
          gl_PointSize = max(1.2, (0.03 + 0.07*big*vHead)*(0.4 + 0.6*vHead)*uPx/-mv.z);
          vA = uAmount*sin(l*3.14159)*step(0.0, life)*(0.25 + 0.75*vHead*vHead)*(0.7 + 0.3*sin(uTime*5.0 + aS*70.0)); }`,
      fragmentShader: `varying float vA; varying float vHead;
        void main(){ vec2 uv = gl_PointCoord*2.0 - 1.0; float d = length(uv);
          float core = exp(-d*d*9.0);
          float arms = (exp(-abs(uv.x)*16.0)*(1.0 - abs(uv.y)) + exp(-abs(uv.y)*16.0)*(1.0 - abs(uv.x)))*step(0.99, vHead);
          float a = (core + 0.7*arms)*vA;
          gl_FragColor = vec4(vec3(1.0,0.84,0.55)*a*1.8, 1.0); }`,
    }));
    fall.frustumCulled = false;
    scene.add(fall);
  }

  /* ------------------------------------------------------------ camera path */
  const KEYS = [0, 0.13, 0.24, 0.32, 0.43, 0.54, 0.68, 0.84, 1.0];
  const CP = [[0, 1.95, 4.6], [0, 2.05, 3.85], [0, 2.3, 2.85], [0, 2.55, 1.4], [0, 2.15, -0.9], [0, 2.05, -1.4], [0, 2.3, -2.0], [0, 2.55, -3.55], [0, 2.6, -4.55]].map((a) => new THREE.Vector3(...a));
  const CL = [[0, 1.3, 0.1], [0, 1.95, -4], [0, 3.1, -3.6], [0, 6.0, -9], [0, 8.6, -14], [0, 5.4, -10], [0, 3.9, -7], [0, 2.7, -6], [0, 2.56, -6]].map((a) => new THREE.Vector3(...a));
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function catmull(arr, i, u, out) {
    const p0 = arr[Math.max(0, i - 1)], p1 = arr[i], p2 = arr[Math.min(arr.length - 1, i + 1)], p3 = arr[Math.min(arr.length - 1, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    for (const k of ["x", "y", "z"]) {
      out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
    }
    return out;
  }
  function pathAt(p, posOut, lookOut) {
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1]) i++;
    let u = clamp((p - KEYS[i]) / (KEYS[i + 1] - KEYS[i]));
    u = u * 0.45 + sstep(0, 1, u) * 0.55;
    catmull(CP, i, u, posOut); catmull(CL, i, u, lookOut);
    if (camera.aspect >= 0.8) {
      // landscape: the copy sits left, so frame the lectern book to the right in the hero
      const hero = 1 - sstep(0.02, 0.16, p);
      lookOut.x -= 0.75 * hero; posOut.x -= 0.3 * hero;
    }
    if (camera.aspect < 0.8) {
      // portrait: keep the lectern book below the hero text, and step back for the close-up
      const hero = 1 - sstep(0.0, 0.14, p);
      lookOut.y += 1.15 * hero; posOut.z += 0.2 * hero;
      const end = sstep(0.78, 1.0, p);
      posOut.z += 0.95 * end; posOut.y += 0.1 * end;
    }
  }

  /* ------------------------------------------------------------ interaction state */
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, inside: false, down: false, dragX: 0, dragY: 0, lastX: 0, lastY: 0, moved: 0 };
  let yawDrag = 0, pitchDrag = 0;
  let P = 0, Ptarget = 0, velocity = 0;
  addEventListener("vs:progress", (e) => { Ptarget = e.detail.p; velocity = e.detail.v || 0; });

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = -1, pulled = null, turning = null;
  const pullAnim = new Map(); // id -> current pull offset
  const card = document.getElementById("record-card");
  const cardQuote = document.getElementById("rc-quote");
  const cardWho = document.getElementById("rc-who");
  const cardClose = document.getElementById("rc-close");
  const REVIEWS = [...document.querySelectorAll("#reviews figure")].map((f) => ({
    q: f.querySelector("blockquote p").textContent.trim(),
    w: f.querySelector("figcaption").childNodes[0].textContent.trim(),
    s: (f.querySelector("figcaption span") || {}).textContent || "",
  }));
  REVIEWS.push({ q: "The records hold no judgement, only compassion and wisdom for your soul's highest good.", w: "Rekha Bala", s: "" });
  let reviewIdx = 0;
  const interactive = () => P < 0.2 && !pulled;

  function pickBook(clientX, clientY) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const o = raycaster.ray.origin, d = raycaster.ray.direction;
    let best = -1, bestT = 1e9;
    for (const s of [-1, 1]) {
      if (Math.abs(d.x) < 1e-4) continue;
      const t = (s * (AISLE + 0.015) - o.x) / d.x;
      if (t <= 0 || t > 9 || t > bestT) continue;
      const y = o.y + d.y * t, z = o.z + d.z * t;
      const level = Math.floor((y - BASE_Y) / LEVEL_H);
      if (level < 0 || level >= Q.levels) continue;
      const row = rows.get(`${s}|${level}`);
      if (!row || !row.length) continue;
      let lo = 0, hi = row.length - 1;          // rows are sorted by z descending
      while (lo < hi) { const mid = (lo + hi) >> 1; if (bookData[row[mid]].z1 > z) lo = mid + 1; else hi = mid; }
      const b = bookData[row[lo]];
      if (z <= b.z0 && z >= b.z1 && y <= BASE_Y + level * LEVEL_H + b.h) { best = row[lo]; bestT = t; }
    }
    return best;
  }
  function hitBookOnLectern(clientX, clientY) {
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([pageL, pageR, turnPage], false).length > 0;
  }

  function startTurn() { if (!turning) turning = { t: 0, dur: 1.25 }; }

  const pulledMesh = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ map: spineMap, roughness: 0.55, emissive: 0xc8913a, emissiveMap: spineGlow, emissiveIntensity: 0.5 }));
  pulledMesh.visible = false;
  scene.add(pulledMesh);
  function pull(id) {
    if (id < 0 || pulled) return;
    const b = bookData[id];
    pulled = { id, t: 0, dir: 1, from: new THREE.Vector3(b.x - b.s * 0.08, b.y, b.z), fromQ: new THREE.Quaternion().setFromEuler(new THREE.Euler(b.lean, 0, 0)) };
    pulledMesh.material.color.copy(b.c).multiplyScalar(1.25);
    pulledMesh.scale.set(b.d, b.h, b.t);
    pulledMesh.position.copy(pulled.from); pulledMesh.quaternion.copy(pulled.fromQ);
    pulledMesh.visible = true;
    books.setMatrixAt(id, m4.makeScale(0, 0, 0)); books.instanceMatrix.needsUpdate = true;
    hovered = -1; canvas.style.cursor = "";
    const r = REVIEWS[reviewIdx++ % REVIEWS.length];
    cardQuote.textContent = r.q; cardWho.textContent = r.s ? `${r.w}, ${r.s}` : r.w;
    setTimeout(() => { card.hidden = false; requestAnimationFrame(() => card.classList.add("open")); cardClose.focus({ preventScroll: true }); }, 650);
  }
  function putBack() {
    if (!pulled || pulled.dir < 0) return;
    pulled.dir = -1;
    card.classList.remove("open");
    setTimeout(() => { card.hidden = true; }, 350);
  }
  cardClose.addEventListener("click", putBack);
  addEventListener("keydown", (e) => { if (e.key === "Escape") putBack(); });
  const pullBtn = document.getElementById("pull-record");
  if (pullBtn) pullBtn.addEventListener("click", () => {
    // pick a book near eye level on a nearby shelf
    const cands = bookData.map((b, i) => i).filter((i) => { const b = bookData[i]; return b.z < 2.5 && b.z > -3 && b.level >= 3 && b.level <= 6; });
    pull(cands[(Math.random() * cands.length) | 0]);
  });

  canvas.addEventListener("pointermove", (e) => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = -(e.clientY / innerHeight) * 2 + 1; pointer.inside = true;
    if (pointer.down) {
      const dx = e.clientX - pointer.lastX, dy = e.clientY - pointer.lastY;
      pointer.moved += Math.abs(dx) + Math.abs(dy);
      if (e.pointerType !== "touch" || Math.abs(dx) > Math.abs(dy)) {
        yawDrag = clamp(yawDrag - dx * 0.0035, -0.6, 0.6);
        if (e.pointerType !== "touch") pitchDrag = clamp(pitchDrag + dy * 0.0025, -0.3, 0.3);
      }
      pointer.lastX = e.clientX; pointer.lastY = e.clientY;
    }
    pointer.cx = e.clientX; pointer.cy = e.clientY; pointer.needPick = true;
  });
  canvas.addEventListener("pointerleave", () => { pointer.inside = false; });
  canvas.addEventListener("pointerdown", (e) => { pointer.down = true; pointer.moved = 0; pointer.lastX = e.clientX; pointer.lastY = e.clientY; });
  addEventListener("pointerup", (e) => {
    const wasClick = pointer.down && pointer.moved < 8 && e.target === canvas;
    pointer.down = false;
    if (!wasClick) return;
    if (pulled) { putBack(); return; }
    if (!interactive() && P > 0.86) { startTurn(); return; }
    if (!interactive()) return;
    if (hitBookOnLectern(e.clientX, e.clientY)) { startTurn(); return; }
    pull(pickBook(e.clientX, e.clientY));
  });

  /* ------------------------------------------------------------ resize */
  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : w / h < 1.2 ? 58 : 50;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    updatePx();
  }
  addEventListener("resize", resize);
  resize();

  /* ------------------------------------------------------------ loop */
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), dir = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3();
  const loading = document.querySelector(".rail .loading");
  if (loading) loading.textContent = "Building the library…";
  let last = performance.now(), frameN = 0, slowFrames = 0, quality = 1;
  let started = false, verySlow = 0;
  function toFilm() {
    const u = new URL(location.href);
    u.searchParams.set("film", "");
    location.replace(u.toString().replace("film=", "film"));
  }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); toFilm(); });
  const clock0 = performance.now();

  function update(dt, t) {
    P = recording ? Ptarget : damp(P, Ptarget, 5.5, dt);
    pointUniforms.uTime.value = t;

    // camera
    pathAt(P, pos, look);
    pointer.sx = damp(pointer.sx, pointer.inside ? pointer.x : 0, 3, dt);
    pointer.sy = damp(pointer.sy, pointer.inside ? pointer.y : 0, 3, dt);
    if (!pointer.down) { yawDrag = damp(yawDrag, 0, 1.4, dt); pitchDrag = damp(pitchDrag, 0, 1.4, dt); }
    const yaw = -pointer.sx * 0.11 + yawDrag, pitch = pointer.sy * 0.07 + pitchDrag;
    dir.subVectors(look, pos).normalize();
    dir.applyAxisAngle(up, yaw);
    right.crossVectors(dir, up).normalize();
    dir.applyAxisAngle(right, pitch);
    camera.position.copy(pos);
    camera.position.y += Math.sin(t * 0.5) * 0.012;
    camera.lookAt(tmpA.copy(pos).add(dir));

    // scene states, timed to the same windows as the film
    const vortexOn = sstep(0.12, 0.215, P);
    const toSky = sstep(0.30, 0.43, P);
    vortexU.uAmount.value = vortexOn * (1 - 0.35 * sstep(0.88, 1.0, P));
    vortexU.uTilt.value = toSky;
    vortexU.uScale.value = lerp(2.1, 7.0, toSky);
    vortexU.uViolet.value = lerp(0.25, 1.0, toSky);
    vortexU.uSpin.value = lerp(1.0, 0.35, toSky);
    vortexU.uCenter.value.set(0, lerp(3.25, 14.5, toSky), lerp(-3.6, -15, toSky));
    sky.material.uniforms.uReveal.value = toSky;
    ceilMat.opacity = 1 - toSky; ceiling.visible = ceilMat.opacity > 0.01;
    scene.fog.density = lerp(0.05, 0.032, toSky);
    scene.fog.color.copy(FOG).lerp(new THREE.Color(0x0a0818), toSky);
    skyLight.intensity = toSky * 0.9;

    const lift = sstep(0.49, 0.6, P);
    book.position.lerpVectors(BOOK_A, BOOK_B, lift);
    book.position.y += Math.sin(t * 0.9) * 0.035 * lift;
    book.rotation.set(lerp(0.42, 1.2, lift), Math.sin(t * 0.35) * 0.08 * lift, 0);
    const starAmt = sstep(0.55, 0.63, P) * (1 - sstep(0.9, 0.98, P));
    starsU.uAmount.value = starAmt;
    starsU.uFrom.value.copy(vortexU.uCenter.value);
    starsU.uScale.value = vortexU.uScale.value;
    starsU.uTo.value.copy(book.position);
    const rad = sstep(0.8, 0.95, P);
    rays.material.opacity = rad * 0.38; rays.scale.setScalar(0.4 + 1.3 * rad);
    rays.material.rotation = t * 0.03;
    coreGlow.material.opacity = Math.min(0.6, starAmt * 0.3 + rad * 0.45); coreGlow.scale.setScalar(0.18 + 0.22 * rad + 0.12 * starAmt);
    bookLight.intensity = 0.6 * starAmt + 1.6 * rad;
    pageMat.emissiveIntensity = 0.03 + 0.05 * starAmt + 0.14 * rad;
    keyLight.intensity = lerp(9, 5, lift);

    // pages: click to turn in the library; flip on their own at the end
    if (!turning && P > 0.86 && P < 0.995 && !recording) turning = { t: 0, dur: 0.85 };
    if (recording && P > 0.86) { setTurn((t * 3.0) % Math.PI); }
    else if (turning) {
      turning.t += dt / turning.dur;
      setTurn(Math.PI * sstep(0, 1, turning.t));
      if (turning.t >= 1) { turning = null; setTurn(0); }
    }

    // dust reacts to the cursor and to scroll speed
    dustUniforms.uMouse.value.set(pointer.inside ? pointer.sx : 9, pointer.inside ? pointer.sy : 9);
    dustUniforms.uSpeed.value = damp(dustUniforms.uSpeed.value, 1 + Math.min(4, Math.abs(velocity) / 600), 2, dt);

    updateCandles(t);

    // hover a book: it slides out and warms
    if (pointer.needPick && interactive() && pointer.inside) {
      pointer.needPick = false;
      const id = pickBook(pointer.cx, pointer.cy);
      const overPages = id < 0 && hitBookOnLectern(pointer.cx, pointer.cy);
      if (id !== hovered) { hovered = id; }
      canvas.style.cursor = id >= 0 || overPages ? "pointer" : "";
    } else if (!interactive() && hovered >= 0) { hovered = -1; canvas.style.cursor = ""; }
    if (hovered >= 0 && !pullAnim.has(hovered)) pullAnim.set(hovered, 0);
    for (const [id, off] of pullAnim) {
      const target = id === hovered ? 0.085 : 0;
      const n = damp(off, target, 10, dt);
      const b = bookData[id];
      if (pulled && pulled.id === id) { pullAnim.delete(id); continue; }
      books.setMatrixAt(id, bookMatrix(b, n));
      const c = tmpB.set(b.c.r, b.c.g, b.c.b).multiplyScalar(1 + 6 * n);
      books.setColorAt(id, new THREE.Color(c.x, c.y, c.z));
      if (Math.abs(n - target) < 0.001 && target === 0) { pullAnim.delete(id); books.setMatrixAt(id, bookMatrix(b, 0)); books.setColorAt(id, b.c); }
      else pullAnim.set(id, n);
      books.instanceMatrix.needsUpdate = true; books.instanceColor.needsUpdate = true;
    }

    // a pulled book floats to the reader, then goes home
    if (pulled) {
      pulled.t = clamp(pulled.t + (dt / 0.9) * pulled.dir);
      const k = sstep(0, 1, pulled.t);
      const front = tmpA.copy(camera.position).add(tmpB.copy(dir).multiplyScalar(0.9)).addScaledVector(up, innerWidth / innerHeight < 0.8 ? 0.16 : 0.13).addScaledVector(right, innerWidth / innerHeight < 0.8 ? 0 : -0.12);
      pulledMesh.position.lerpVectors(pulled.from, front, k);
      const faceQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pulledMesh.position, camera.position, up));
      const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.sin(t * 0.8) * 0.12, 0.08));
      faceQ.multiply(tilt);
      pulledMesh.quaternion.copy(pulled.fromQ).slerp(faceQ, k);
      if (pulled.dir < 0 && pulled.t <= 0) {
        const b = bookData[pulled.id];
        books.setMatrixAt(pulled.id, bookMatrix(b, 0)); books.setColorAt(pulled.id, b.c);
        books.instanceMatrix.needsUpdate = true; books.instanceColor.needsUpdate = true;
        pulledMesh.visible = false; pulled = null;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frameN++;
    // after the journey the scene sits dimmed behind the content: render it less often
    if (P > 0.999 && Ptarget > 0.999 && frameN % 3) return;
    update(dt, (now - clock0) / 1000);
    composer.render(dt);
    if (!started) {
      started = true;
      document.documentElement.classList.add("scene-ready");
      if (loading) { loading.textContent = "The library is ready"; setTimeout(() => loading.classList.add("done"), 1200); }
    }
    // adapt to slower devices; if even the lightest setting can't keep up, use the video version
    if (frameN > 30 && frameN < 420 && !recording) {
      if (dt > 1 / 38) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 40 && quality > 0.6) {
        quality -= 0.2; slowFrames = 0;
        renderer.setPixelRatio(Q.dpr * quality); composer.setPixelRatio(Q.dpr * quality); resize();
      }
      if (quality <= 0.6) { if (dt > 1 / 10) verySlow++; else verySlow = Math.max(0, verySlow - 2); }
      if (verySlow > 30) toFilm();
    }
  }
  updateCandles(0);
  try { renderer.compile(scene, camera); } catch (e) { /* compile lazily */ }
  // ?record&manual: no render loop; a capture script steps frames on a virtual clock
  const manual = recording && /[?&]manual\b/.test(location.search);
  let vt = 0;
  if (manual) {
    window.VS3D_frame = (dt) => {
      vt += dt; frameN++;
      update(dt, vt); composer.render(dt);
      if (!started) { started = true; document.documentElement.classList.add("scene-ready"); if (loading) loading.classList.add("done"); }
    };
    window.VS3D_frame(1 / 30);
  } else requestAnimationFrame(frame);
  window.VS3D = { setProgress: (p) => { Ptarget = p; }, pull, startTurn, pick: pickBook, state: () => ({ P, hovered, pulled: !!pulled, inside: pointer.inside, n: bookData.length }) };
}

if (document.documentElement.dataset.mode === "3d") boot();
