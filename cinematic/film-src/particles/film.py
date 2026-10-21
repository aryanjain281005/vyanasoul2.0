"""
VyanaSoul — "The Record" : procedural cinematic particle film.

Every frame is rendered from ~400k particles of light with thin-lens depth of
field (bokeh), multi-scale bloom, a faint anamorphic streak and ACES tone mapping.

Story (t in [0,1]):
  seed     — a single breathing point of light (the soul)
  akasha   — it blooms into a vast slow vortex of light (the Akashic field)
  book     — the field condenses into an open book written in light (the record)
  lotus    — the writing lifts into a turning lotus over a flower of life (healing)
  dawn     — the lotus falls into a calm sea of light under a rising sun (clarity)
"""
import numpy as np
from numpy import pi
from scipy import ndimage, signal

RNG = np.random.default_rng(369)

N = 380_000          # morphing particles
ND = 70_000          # ambient dust

# ----------------------------------------------------------------- utilities
def smooth(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)

def smoother(x):
    x = np.clip(x, 0, 1)
    return x * x * x * (x * (x * 6 - 15) + 10)

def rot_x(p, a):
    c, s = np.cos(a), np.sin(a)
    y = p[:, 1] * c - p[:, 2] * s
    z = p[:, 1] * s + p[:, 2] * c
    return np.stack([p[:, 0], y, z], 1)

def rot_y(p, a):
    c, s = np.cos(a), np.sin(a)
    if np.ndim(a):
        x = p[:, 0] * c + p[:, 2] * s
        z = -p[:, 0] * s + p[:, 2] * c
    else:
        x = p[:, 0] * c + p[:, 2] * s
        z = -p[:, 0] * s + p[:, 2] * c
    return np.stack([x, p[:, 1], z], 1)

def rot_z(p, a):
    c, s = np.cos(a), np.sin(a)
    x = p[:, 0] * c - p[:, 1] * s
    y = p[:, 0] * s + p[:, 1] * c
    return np.stack([x, y, p[:, 2]], 1)

# palette (linear-ish light colours)
WHITE = np.array([1.00, 0.93, 0.80])
GOLD = np.array([1.00, 0.70, 0.30])
AMBER = np.array([0.95, 0.45, 0.16])
VIOLET = np.array([0.52, 0.45, 1.00])
ROSE = np.array([1.00, 0.55, 0.55])

def mix_col(a, b, t):
    t = np.asarray(t)[..., None]
    return a * (1 - t) + b * t

# per-particle constants
SEED = RNG.random(N)                 # stagger / variety
TEMP = RNG.random(N)                 # colour temperature
SPARK = RNG.lognormal(0, 0.55, N)    # brightness variety
PHASE = RNG.random(N) * 2 * pi
NOISE_DIR = RNG.normal(size=(N, 3))
NOISE_DIR /= np.linalg.norm(NOISE_DIR, axis=1, keepdims=True)
ACCENT = RNG.random(N) < 0.04        # violet accent particles

def base_colour(warmth):
    """warmth 0 = white-gold core, 1 = deep amber; accents violet."""
    c = np.where((TEMP < 0.22)[:, None],
                 mix_col(WHITE, GOLD, TEMP / 0.22),
                 mix_col(GOLD, AMBER, ((TEMP - 0.22) / 0.78) ** 1.5 * warmth))
    c = np.where(ACCENT[:, None], VIOLET, c)
    return c

def order_by(points, key):
    idx = np.argsort(key, kind="stable")
    return points[idx], idx

# ----------------------------------------------------------------- shapes
# Every builder returns (positions, intensity, extra) where extra[:, 0] is a
# hue weight (0 = gold palette, 1 = violet) and the other columns are
# shape-specific parameters. Points are matched to particle slots by angle
# around the vertical axis, so the flow between shapes stays coherent.

PARTICLE_ORDER = np.argsort(RNG.random(N))
VIOLET_SOFT = np.array([0.62, 0.52, 1.00])

def unit(n):
    d = RNG.normal(size=(n, 3))
    return d / np.linalg.norm(d, axis=1, keepdims=True)

def match(points, intens, extra):
    ang = np.arctan2(points[:, 2], points[:, 0])
    key = np.floor((ang + pi) / (2 * pi) * 48) + 0.5 * (np.tanh(points[:, 1]) + 1) * 0.999
    order = np.argsort(key, kind="stable")
    out_p = np.empty_like(points); out_i = np.empty_like(intens); out_e = np.empty_like(extra)
    out_p[PARTICLE_ORDER] = points[order]
    out_i[PARTICLE_ORDER] = intens[order]
    out_e[PARTICLE_ORDER] = extra[order]
    return out_p, out_i, out_e

# --- seed: a star of light with three slow orbits -----------------------------
RING_R = np.array([0.42, 0.66, 0.98])
RING_W = np.array([0.55, 0.36, 0.24])

def build_seed():
    k = RNG.random(N)
    p = np.zeros((N, 3)); inten = np.zeros(N); ex = np.zeros((N, 4))
    core = k < 0.78
    n = core.sum()
    p[core] = unit(n) * (np.abs(RNG.normal(0, 1, n)) ** 2.2 * 0.02)[:, None]
    inten[core] = 0.016
    halo = (k >= 0.78) & (k < 0.86)
    n = halo.sum()
    p[halo] = unit(n) * (0.04 + np.abs(RNG.normal(0, 0.32, n)) ** 1.4)[:, None]
    inten[halo] = 0.05
    ex[halo, 0] = 0.25
    ring = k >= 0.86
    n = ring.sum()
    rid = RNG.choice([0, 1, 2], n, p=[0.28, 0.34, 0.38])
    ex[ring, 1] = 1
    ex[ring, 2] = rid
    ex[ring, 3] = RNG.random(n) * 2 * pi
    ex[ring, 0] = np.where(rid == 1, 0.85, 0.1)
    inten[ring] = 0.035
    p[ring] = 0
    return match(p, inten * SPARK, ex)

def seed_at(base, ex, tt):
    p = base.copy()
    g = np.ones(N)
    core = ex[:, 1] == 0
    breath = 1 + 0.10 * np.sin(tt * 2.4)
    p[core] *= breath
    for rid in range(3):
        m = (ex[:, 1] == 1) & (ex[:, 2] == rid)
        a = ex[m, 3] + RING_W[rid] * tt
        R = RING_R[rid]
        q = np.stack([R * np.cos(a), np.zeros(m.sum()), R * np.sin(a)], 1)
        p[m] = q
        # a travelling highlight runs around each orbit
        h = ((ex[m, 3] - RING_W[rid] * tt * 1.6) / (2 * pi)) % 1.0
        g[m] = 0.22 + 2.4 * h ** 12
    # same tilt as the vortex it becomes
    p = rot_x(p, 0.42)
    p = rot_z(p, -0.18)
    return p, g

# --- akasha vortex ------------------------------------------------------------------
def build_akasha():
    arms = 5
    arm = RNG.integers(0, arms, N)
    strand = RNG.integers(0, 36, N)
    s = RNG.random(N) ** 0.75
    r = 0.12 + 3.7 * s ** 1.25
    theta = arm * 2 * pi / arms + 2.7 * pi * s + (strand - 18) * 0.009 * (1 + 2 * s) + RNG.normal(0, 0.004, N) * (1 + 3 * s)
    h = 0.20 * np.sin(3 * theta + strand * 0.35) * s + RNG.normal(0, 0.006 + 0.012 * s, N)
    haze = RNG.random(N) < 0.10
    theta = np.where(haze, RNG.random(N) * 2 * pi, theta)
    r = np.where(haze, 0.2 + 3.6 * RNG.random(N) ** 0.8, r)
    h = np.where(haze, RNG.normal(0, 0.10, N), h)
    p = np.stack([r * np.cos(theta), h, r * np.sin(theta)], 1)
    inten = (0.55 * np.exp(-r * 0.45) + 0.10) * SPARK
    inten = np.where(haze, inten * 0.3, inten)
    inten = np.where(r < 0.45, inten * 1.6, inten)
    ex = np.zeros((N, 2))
    ex[:, 0] = np.clip((r - 1.3) / 2.2, 0, 1) ** 1.2 * 0.85
    ex[:, 0] = np.where(haze, 0.6, ex[:, 0])
    return match(p, inten, ex)

def akasha_at(base, tt):
    r = np.sqrt(base[:, 0] ** 2 + base[:, 2] ** 2)
    p = rot_y(base, -(0.9 / (0.6 + r)) * tt * 2.2)
    p = rot_x(p, 0.42)
    p = rot_z(p, -0.18)
    return p

# --- book of light ---------------------------------------------------------------------
PAGE_W, PAGE_H = 1.55, 2.1

def page_z(u):
    au = np.abs(u) / PAGE_W
    return 0.30 * (1 - np.exp(-5.0 * au)) - 0.10 * au ** 3

def build_book():
    k = RNG.random(N)
    side = np.where(RNG.random(N) < 0.5, -1.0, 1.0)
    u = np.zeros(N); v = np.zeros(N); w = np.zeros(N)
    inten = np.zeros(N); hue = np.zeros(N)
    role = np.zeros(N)
    lines = 24
    t_mask = k < 0.50
    n = t_mask.sum()
    line = RNG.integers(0, lines, n)
    x = RNG.random(n)
    word_noise = np.sin(x * 61.0 + line * 3.1) + np.sin(x * 23.0 + line * 1.7)
    keep = word_noise > -0.9
    x = np.where(keep, x, RNG.random(n))
    margin = 0.13
    uu = margin + x * (PAGE_W - 2 * margin)
    para_end = (line % 6) == 5
    uu = np.where(para_end & (x > 0.55), margin + RNG.random(n) * 0.55 * (PAGE_W - 2 * margin), uu)
    vv = PAGE_H / 2 - 0.2 - line * (PAGE_H - 0.4) / (lines - 1) + RNG.normal(0, 0.006, n)
    u[t_mask] = uu; v[t_mask] = vv; inten[t_mask] = 0.16; role[t_mask] = 0
    f_mask = (k >= 0.50) & (k < 0.74)
    n = f_mask.sum()
    u[f_mask] = RNG.random(n) * PAGE_W; v[f_mask] = (RNG.random(n) - 0.5) * PAGE_H
    inten[f_mask] = 0.03; role[f_mask] = 1
    e_mask = (k >= 0.74) & (k < 0.84)
    n = e_mask.sum()
    e = RNG.random(n)
    which = RNG.integers(0, 3, n)
    eu = np.where(which == 0, PAGE_W, e * PAGE_W)
    ev = np.where(which == 1, PAGE_H / 2, np.where(which == 2, -PAGE_H / 2, (e - 0.5) * PAGE_H))
    u[e_mask] = np.abs(eu + RNG.normal(0, 0.004, n)); v[e_mask] = ev + RNG.normal(0, 0.004, n)
    inten[e_mask] = 0.12; role[e_mask] = 2
    s_mask = (k >= 0.84) & (k < 0.965)
    n = s_mask.sum()
    u[s_mask] = PAGE_W * (0.55 + 0.45 * RNG.random(n) ** 0.3)
    v[s_mask] = (RNG.random(n) - 0.5) * PAGE_H
    w[s_mask] = -RNG.random(n) * 0.12
    inten[s_mask] = 0.05; role[s_mask] = 4
    k_mask = k >= 0.965
    n = k_mask.sum()
    u[k_mask] = 0.15 + RNG.random(n) * (PAGE_W - 0.3); v[k_mask] = (RNG.random(n) - 0.5) * (PAGE_H - 0.4)
    inten[k_mask] = 0.55; role[k_mask] = 3; hue[k_mask] = 0.3
    x = side * u
    p = np.stack([x, v, page_z(u) + w], 1)
    ex = np.stack([hue, role, side, u, v, w], 1)
    return match(p, inten * SPARK, ex)

def book_at(base, ex, turn, tt):
    role = ex[:, 1]; side = ex[:, 2]; u = ex[:, 3]
    p = base.copy()
    g = np.ones(N)
    turning = (side > 0) & (role <= 2) & (SEED > 0.5)
    if turn > 0:
        phi = pi * smoother(turn)
        uu = u[turning]
        ang = phi + np.sin(phi) * 0.35 * (np.abs(uu) / PAGE_W) ** 1.6
        p[turning, 0] = uu * np.cos(ang)
        p[turning, 2] = page_z(uu) + uu * np.sin(ang) * 0.85 + 0.015 * np.sin(phi)
    sp = role == 3
    life = (tt * 0.55 + SEED[sp] * 7.3) % 1.0
    p[sp, 2] += life * 0.9 + 0.03
    p[sp, 0] += np.sin(life * 6 + PHASE[sp]) * 0.04
    p[sp, 1] += life * 0.18
    g[sp] = np.sin(pi * life) ** 4
    p = rot_x(p, -1.05)
    p = rot_y(p, 0.10)
    p[:, 1] -= 0.25
    return p, g

# --- lotus over a flower of life -----------------------------------------------------
def build_lotus():
    k = RNG.random(N)
    pts = np.zeros((N, 3)); inten = np.zeros(N)
    ex = np.zeros((N, 5))  # hue, layer, alpha, s, side
    pm = k < 0.52
    n = pm.sum()
    layer = RNG.choice([0, 1, 2], n, p=[0.30, 0.36, 0.34])
    count = np.array([8, 8, 12])[layer]
    idx = (RNG.random(n) * count).astype(int)
    offset = np.array([0.0, pi / 8, pi / 12])[layer]
    alpha = idx * 2 * pi / count + offset
    s = RNG.random(n)
    edge = RNG.random(n) < 0.78
    side = np.where(RNG.random(n) < 0.5, -1, 1)
    ex[pm, 1] = layer; ex[pm, 2] = alpha; ex[pm, 3] = s; ex[pm, 4] = np.where(edge, side, 0)
    ex[pm, 0] = np.where(layer == 2, 0.25, 0.0)
    inten[pm] = np.where(edge, 0.14, 0.07)
    fm = (k >= 0.52) & (k < 0.80)
    n = fm.sum()
    R = 0.42
    centres = [(0, 0)]
    for i in range(6):
        a = i * pi / 3
        centres.append((R * np.cos(a), R * np.sin(a)))
    for i in range(6):
        a = i * pi / 3
        centres.append((2 * R * np.cos(a), 2 * R * np.sin(a)))
        a2 = a + pi / 6
        centres.append((np.sqrt(3) * R * np.cos(a2), np.sqrt(3) * R * np.sin(a2)))
    centres = np.array(centres)
    nc = len(centres)
    ci = RNG.integers(0, nc + 2, n)
    th = RNG.random(n) * 2 * pi
    rr = np.where(ci < nc, R, np.where(ci == nc, 3 * R, 3 * R + 0.06))
    cx = np.where(ci < nc, centres[np.minimum(ci, nc - 1), 0], 0)
    cz = np.where(ci < nc, centres[np.minimum(ci, nc - 1), 1], 0)
    pts[fm, 0] = cx + rr * np.cos(th) + RNG.normal(0, 0.003, n)
    pts[fm, 2] = cz + rr * np.sin(th) + RNG.normal(0, 0.003, n)
    pts[fm, 1] = -0.55 + RNG.normal(0, 0.003, n)
    inten[fm] = 0.07
    ex[fm, 1] = -1; ex[fm, 0] = 0.6
    cm = (k >= 0.80) & (k < 0.86)
    n = cm.sum()
    pts[cm] = unit(n) * (np.abs(RNG.normal(0, 1, n)) ** 1.8 * 0.05)[:, None] + np.array([0, -0.05, 0])
    inten[cm] = 0.05
    ex[cm, 1] = -2
    mm = k >= 0.86
    n = mm.sum()
    a = RNG.random(n) * 2 * pi
    r = np.abs(RNG.normal(0, 0.9, n))
    pts[mm] = np.stack([r * np.cos(a), np.zeros(n), r * np.sin(a)], 1)
    inten[mm] = 0.12
    ex[mm, 1] = -3; ex[mm, 0] = 0.35
    return match(pts, inten * SPARK, ex)

def petal_point(layer, alpha, s, side, openness):
    L = np.array([0.95, 1.25, 1.55])[layer]
    W = np.array([0.30, 0.40, 0.44])[layer]
    tilt0 = np.array([1.25, 0.95, 0.55])[layer]
    tilt = tilt0 * (1.0 - 0.35 * openness) + (1 - openness) * 0.45
    width = W * np.sin(pi * s) ** 0.85 * np.where(side == 0, 0, 1) * side
    along = s * L
    lift = 0.18 * s ** 2.2
    r = along * np.cos(tilt) + 0.08
    y = along * np.sin(tilt) + lift - 0.48
    ca, sa = np.cos(alpha), np.sin(alpha)
    return np.stack([r * ca - width * sa, y, r * sa + width * ca], 1)

def lotus_at(base, ex, spin, openness, tt):
    p = base.copy()
    g = np.ones(N)
    layer = ex[:, 1]
    pm = layer >= 0
    p[pm] = petal_point(layer[pm].astype(int), ex[pm, 2], ex[pm, 3], ex[pm, 4], openness)
    mm = layer == -3
    life = (tt * 0.35 + SEED[mm] * 5.1) % 1.0
    p[mm, 1] = -0.5 + life * 2.6
    sw = 1 - life * 0.6
    p[mm, 0] *= sw; p[mm, 2] *= sw
    g[mm] = np.sin(pi * life) ** 2
    return rot_y(p, spin), g

# --- dawn: a sea of light under a rising sun ---------------------------------------
def build_dawn():
    k = RNG.random(N)
    pts = np.zeros((N, 3)); inten = np.zeros(N)
    ex = np.zeros((N, 3))  # hue, kind, phase
    sea = k < 0.80
    n = sea.sum()
    zz = 3.0 - 80 * RNG.random(n) ** 1.6
    xx = (RNG.random(n) - 0.5) * (8 + np.abs(zz - 6) * 1.5)
    pts[sea, 0] = xx; pts[sea, 2] = zz; pts[sea, 1] = -1.0
    inten[sea] = 0.16
    ex[sea, 2] = RNG.random(n) * 2 * pi
    cloud = (k >= 0.80) & (k < 0.88)
    n = cloud.sum()
    band = RNG.integers(0, 7, n)
    by = np.array([0.6, 1.1, 1.9, 2.6, 3.8, 5.0, 6.6])[band]
    bx = np.array([-14, 9, -4, 16, -10, 5, -18])[band]
    bl = np.array([22, 30, 18, 26, 34, 24, 30])[band]
    xs = RNG.normal(0, 1, n) * bl / 2.5
    pts[cloud, 0] = bx + xs
    pts[cloud, 1] = by + RNG.normal(0, 0.10 + 0.04 * band, n) + 0.002 * xs ** 2 * 0.0
    pts[cloud, 2] = -64 + RNG.normal(0, 3, n)
    inten[cloud] = 0.22 * np.exp(-(xs / bl * 2.5) ** 2 * 0.5)
    ex[cloud, 1] = 2
    ex[cloud, 0] = np.where(band >= 4, 0.55, 0.15)
    sun = k >= 0.88
    n = sun.sum()
    a = RNG.random(n) * 2 * pi
    corona = RNG.random(n) < 0.35
    rr = np.sqrt(RNG.random(n)) * 2.8
    rr = np.where(corona, 2.8 + np.abs(RNG.normal(0, 1.8, n)), rr)
    pts[sun, 0] = rr * np.cos(a); pts[sun, 1] = rr * np.sin(a); pts[sun, 2] = -75
    limb = np.sqrt(np.clip(1 - (rr / 2.8) ** 2, 0, 1))
    inten[sun] = np.where(corona, 0.7, 2.5 + 8.0 * limb)
    ex[sun, 1] = 1
    return match(pts, inten * SPARK, ex)

def dawn_at(base, ex, tt, rise):
    p = base.copy()
    sea = ex[:, 1] == 0
    x, z = p[sea, 0], p[sea, 2]
    ph = ex[sea, 2]
    p[sea, 1] = -1.0 + (0.035 * np.sin(x * 0.7 + z * 0.45 + tt * 1.6)
                        + 0.025 * np.sin(-x * 1.3 + z * 0.9 + tt * 2.3)
                        + 0.012 * np.sin(x * 3.1 + z * 2.2 + tt * 3.7 + ph * 0.2))
    sun = ex[:, 1] == 1
    p[sun, 1] += -3.2 + rise * 5.8
    cl = ex[:, 1] == 2
    p[cl, 0] += tt * 0.35
    lateral = np.abs(x) / (1.0 + np.abs(z) * 0.07)
    path = np.exp(-lateral ** 2 * 1.4)
    glint = np.clip(np.sin(ph + tt * 30 + x * 2.0), 0, 1) ** 6
    g = np.ones(N)
    dist = np.clip(np.abs(z - 6.0) / 5.5, 1, 9)
    g[sea] = (0.30 + path * (2.0 + 16.0 * glint) * (0.35 + 0.65 * rise)) * dist ** 0.75
    g[cl] = (0.25 + 0.75 * rise) * 6.0
    return p, g

# ----------------------------------------------------------------- dust
DUST = np.stack([RNG.uniform(-9, 9, ND), RNG.uniform(-6, 6, ND), RNG.uniform(-14, 6, ND)], 1)
DUST_I = RNG.lognormal(0, 0.8, ND) * 0.012
DUST_C = np.where((RNG.random(ND) < 0.4)[:, None], VIOLET_SOFT * 0.9, mix_col(WHITE, GOLD, RNG.random(ND)))
DUST_PH = RNG.random(ND) * 2 * pi

def dust_at(t):
    p = DUST.copy()
    p[:, 1] = (p[:, 1] + 6 + t * 2.2) % 12 - 6
    p[:, 0] += 0.25 * np.sin(t * 3 + DUST_PH)
    tw = 0.6 + 0.4 * np.sin(t * 40 + DUST_PH * 3)
    return p, DUST_I * tw

# ----------------------------------------------------------------- build all
print("building shapes…", flush=True)
SD_P, SD_I, SD_E = build_seed()
AK_P, AK_I, AK_E = build_akasha()
BK_P, BK_I, BK_E = build_book()
LO_P, LO_I, LO_E = build_lotus()
DW_P, DW_I, DW_E = build_dawn()
COL_BASE = base_colour(1.0)

# ----------------------------------------------------------------- timeline
T_SEED_AK = (0.10, 0.25)
T_AK_BK = (0.38, 0.51)
T_BK_LO = (0.64, 0.75)
T_LO_DW = (0.86, 0.945)

def stagger(u, spread=0.45):
    return smoother((u - SEED * spread) / (1 - spread))

def flow(a, b, u, amp, swirl):
    m = a * (1 - u)[:, None] + b * u[:, None]
    bump = np.sin(pi * u)
    m = rot_y(m, swirl * bump * (0.6 + SEED))
    m += NOISE_DIR * (amp * bump)[:, None]
    return m

def state(t):
    tt = t * 10.0
    sd, sd_g = seed_at(SD_P, SD_E, tt)
    ak = akasha_at(AK_P, tt)
    bk, bk_g = book_at(BK_P, BK_E, smooth((t - 0.535) / 0.085), tt)
    lo, lo_g = lotus_at(LO_P, LO_E, 0.21 * tt, smooth((t - 0.70) / 0.13), tt)
    dw, dw_g = dawn_at(DW_P, DW_E, tt, smooth((t - 0.87) / 0.13))

    def prog(win):
        return float(np.clip((t - win[0]) / (win[1] - win[0]), 0, 1))
    u1 = stagger(prog(T_SEED_AK), 0.5)
    u2 = stagger(prog(T_AK_BK), 0.45)
    u3 = stagger(prog(T_BK_LO), 0.5)
    u4 = stagger(prog(T_LO_DW), 0.55)

    p = sd
    if prog(T_SEED_AK) > 0:
        p = flow(sd, ak, u1, 0.9, 1.4)
    if prog(T_AK_BK) > 0:
        p = flow(ak, bk, u2, 0.55, -2.2)
    if prog(T_BK_LO) > 0:
        p = flow(bk, lo, u3, 0.35, 1.6) + np.sin(pi * u3)[:, None] * np.array([0, 0.9, 0])
    if prog(T_LO_DW) > 0:
        p = flow(lo, dw, u4, 0.6, 0.8)

    w = [1 - u1, u1 * (1 - u2), u2 * (1 - u3), u3 * (1 - u4), u4]
    I = [SD_I * sd_g, AK_I, BK_I * bk_g, LO_I * lo_g, DW_I * dw_g]
    hue = [SD_E[:, 0], AK_E[:, 0], BK_E[:, 0], LO_E[:, 0], DW_E[:, 0]]
    inten = sum(wi * ii for wi, ii in zip(w, I))
    h = sum(wi * hi for wi, hi in zip(w, hue))
    inten = inten * (0.78 + 0.22 * np.sin(tt * 9 + PHASE * 7))

    col = mix_col(COL_BASE, VIOLET_SOFT, h)
    rose = smooth((t - 0.66) / 0.08) * (1 - smooth((t - 0.86) / 0.1))
    col = mix_col(col, ROSE, 0.22 * rose * (TEMP > 0.72))
    warm = smooth((t - 0.86) / 0.1)
    col = mix_col(col, mix_col(GOLD, AMBER, 0.45), 0.4 * warm)
    return p, inten, col

# ----------------------------------------------------------------- camera
# keyframes: t, eye, target, fov(deg), focus distance, aperture
CAM_KEYS = [
    (0.00, (0.0, 0.25, 4.6), (0.0, 0.0, 0.0), 32, 4.6, 0.9),
    (0.09, (0.0, 0.2, 4.0), (0.0, 0.0, 0.0), 32, 4.0, 1.0),
    (0.22, (0.4, 1.0, 6.4), (0.0, 0.0, 0.0), 40, 6.4, 1.2),
    (0.36, (-0.8, 1.3, 5.8), (0.0, -0.1, 0.0), 40, 5.9, 1.3),
    (0.50, (0.0, 1.1, 5.1), (0.0, -0.15, 0.0), 36, 5.2, 1.0),
    (0.62, (0.45, 1.3, 4.6), (0.0, -0.10, 0.0), 36, 4.75, 1.1),
    (0.74, (0.0, 1.8, 5.6), (0.0, 0.30, 0.0), 36, 5.7, 1.0),
    (0.85, (-0.4, 1.6, 5.0), (0.0, 0.32, 0.0), 38, 5.1, 1.1),
    (0.95, (0.0, 0.05, 6.0), (0.0, -0.35, -30.0), 42, 14.0, 0.6),
    (1.00, (0.0, 0.0, 5.6), (0.0, -0.32, -30.0), 42, 14.0, 0.6),
]

def catmull(p0, p1, p2, p3, u):
    u2, u3 = u * u, u * u * u
    return 0.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3)

def camera(t, aspect):
    keys = CAM_KEYS
    ts = [k[0] for k in keys]
    i = max(0, min(len(keys) - 2, np.searchsorted(ts, t, side="right") - 1))
    u = (t - ts[i]) / (ts[i + 1] - ts[i])
    u = smooth(u) * 0.6 + u * 0.4
    def get(j, f):
        j = max(0, min(len(keys) - 1, j))
        return np.array(keys[j][f], dtype=float)
    vals = []
    for f in range(1, 6):
        vals.append(catmull(get(i - 1, f), get(i, f), get(i + 1, f), get(i + 2, f), u))
    eye, target, fov, focus, ap = vals
    if aspect > 1:
        # desktop only: pull back for the book so it leaves room for the chapter text
        k = 1 + 0.18 * smooth((t - 0.40) / 0.10) * (1 - smooth((t - 0.64) / 0.08))
        eye = target + (eye - target) * k
        focus = focus * k
    return eye, target, float(fov), float(focus), float(ap)

# ----------------------------------------------------------------- renderer
GAIN = 0.16
LAYER_R = np.array([0.0, 1.6, 3.2, 5.5, 9.0, 14.0, 22.0, 34.0])

def disk_kernel(r):
    n = int(np.ceil(r)) + 2
    y, x = np.mgrid[-n:n + 1, -n:n + 1]
    d = np.sqrt(x * x + y * y)
    k = np.clip(r + 0.5 - d, 0, 1)
    # slightly brighter rim like real lens bokeh
    k = k * (0.85 + 0.25 * np.clip((d / max(r, 1e-3)) ** 3, 0, 1))
    return k / k.sum()

KCACHE = {}

def upsample(img, f, H, W):
    out = ndimage.zoom(img, (img.shape[0] and H / img.shape[0], W / img.shape[1], 1), order=1)
    return out[:H, :W]

def blur_layer(img, r):
    if r <= 0.01:
        return ndimage.gaussian_filter(img, sigma=(0.55, 0.55, 0))
    if r < 2.5:
        return ndimage.gaussian_filter(img, sigma=(r * 0.6, r * 0.6, 0))
    # work at reduced resolution for big kernels
    f = 1 if r < 6 else (2 if r < 15 else 4)
    H0, W0 = img.shape[:2]
    if f > 1:
        Hp, Wp = -(-H0 // f) * f, -(-W0 // f) * f
        imgp = np.pad(img, ((0, Hp - H0), (0, Wp - W0), (0, 0))) if (Hp, Wp) != (H0, W0) else img
        small = imgp.reshape(Hp // f, f, Wp // f, f, 3).sum((1, 3))
    else:
        small = img
    rr = r / f
    key = round(rr, 2)
    if key not in KCACHE:
        KCACHE[key] = disk_kernel(rr)
    k = KCACHE[key]
    out = np.stack([signal.oaconvolve(small[..., c], k, mode="same") for c in range(3)], -1)
    if f > 1:
        out = upsample(out, f, Hp, Wp)[:H0, :W0] / (f * f)
    return out

def splat(buf, sx, sy, w3, W, H):
    x0 = np.floor(sx).astype(np.int64); y0 = np.floor(sy).astype(np.int64)
    fx = sx - x0; fy = sy - y0
    for dx, dy, ww in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)), (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi = x0 + dx; yi = y0 + dy
        ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
        idx = yi[ok] * W + xi[ok]
        for c in range(3):
            buf[..., c].reshape(-1)[:] += np.bincount(idx, weights=w3[ok, c] * ww[ok], minlength=W * H)

def project(p, eye, target, fov, W, H, mode):
    fwd = target - eye; fwd /= np.linalg.norm(fwd)
    right = np.cross(fwd, np.array([0, 1.0, 0])); right /= np.linalg.norm(right)
    up = np.cross(right, fwd)
    q = p - eye
    x = q @ right; y = q @ up; d = q @ fwd
    if mode == "portrait":
        f = (W / 2) / np.tan(np.radians(fov) / 2) * 0.80
    else:
        f = (H / 2) / np.tan(np.radians(fov) / 2)
    return x, y, d, f

def render(t, W, H, mode="landscape", exposure=None, frame_offset=(0.0, 0.0)):
    eye, target, fov, focus, ap = camera(t, W / H)
    # composition: subject sits right on desktop, upper on mobile
    p, inten, col = state(t)
    dp, di = dust_at(t)
    P = np.concatenate([p, dp]); I = np.concatenate([inten, di]); C = np.concatenate([col, DUST_C])
    x, y, d, f = project(P, eye, target, fov, W, H, mode)
    ok = d > 0.2
    x, y, d, I, C = x[ok], y[ok], d[ok], I[ok], C[ok]
    ox, oy = frame_offset
    sx = W * (0.5 + ox) + f * x / d
    sy = H * (0.5 + oy) - f * y / d
    scale = min(W, H) / 1080.0
    coc = ap * 26.0 * scale * np.abs(d - focus) / d * (6.0 / focus) ** 0.5
    coc = np.minimum(coc, LAYER_R[-1] * scale)
    # energy per particle: perspective falloff, softened
    e = GAIN * (min(W, H) / 540.0) ** 1.4 * I * (5.5 / np.maximum(d, 0.8)) ** 1.2
    w3 = C * e[:, None]
    hdr = np.zeros((H, W, 3))
    R = LAYER_R * scale
    lr = np.interp(coc, R, np.arange(len(R)))
    lo = np.floor(lr).astype(int); fr = lr - lo
    for L in range(len(R)):
        sel_lo = lo == L
        sel_hi = (lo + 1 == L)
        if not sel_lo.any() and not sel_hi.any():
            continue
        buf = np.zeros((H, W, 3))
        wl = np.where(sel_lo, 1 - fr, 0) + np.where(sel_hi, fr, 0)
        m = wl > 0
        splat(buf, sx[m], sy[m], w3[m] * wl[m, None], W, H)
        hdr += blur_layer(buf, R[L])
    dawn = smooth((t - 0.88) / 0.08)
    if dawn > 0:
        rise = smooth((t - 0.87) / 0.13)
        sun_c = np.array([[0.0, -3.2 + rise * 5.8, -75.0]])
        cx_, cy_, cd_, _ = project(sun_c, eye, target, fov, W, H, mode)
        scx = W * (0.5 + ox) + f * cx_[0] / cd_[0]
        scy = H * (0.5 + oy) - f * cy_[0] / cd_[0]
        yy, xx = np.mgrid[0:H, 0:W]
        rr = np.sqrt((xx - scx) ** 2 + (yy - scy) ** 2) / max(W, H)
        glow = 0.55 * np.exp(-(rr / 0.035) ** 2) + 0.20 * np.exp(-rr / 0.085) + 0.03 * np.exp(-rr / 0.35)
        hdr += dawn * glow[..., None] * np.array([1.0, 0.62, 0.30])
    fwd = target - eye
    fh = np.array([fwd[0], 0.0, fwd[2]]); fh /= np.linalg.norm(fh)
    hx, hyy, hd, _ = project((eye + fh * 1e5)[None, :], eye, target, fov, W, H, mode)
    hy = float((H * (0.5 + oy) - f * hyy[0] / hd[0]) / H)
    return post(hdr, t, W, H, exposure, hy)

def background(t, W, H, hy=0.5):
    yy, xx = np.mgrid[0:H, 0:W]
    u = xx / W - 0.5; v = yy / H - 0.5
    r = np.sqrt((u * W / max(W, H)) ** 2 + (v * H / max(W, H)) ** 2)
    deep = np.array([0.0010, 0.0008, 0.0019])
    mid = np.array([0.0048, 0.0034, 0.0086])
    bg = deep + (mid - deep) * np.exp(-r * r * 6)[..., None]
    dawn = smooth((t - 0.87) / 0.12)
    if dawn > 0:
        horizon = hy
        yn = yy / H
        h = np.clip((yn - (horizon - 0.6)) / 0.6, 0, 1)
        sky = mix_col(np.array([0.004, 0.0035, 0.014]), np.array([0.13, 0.05, 0.03]), h ** 2.6)
        glow = np.exp(-((xx / W - 0.5) * W / H) ** 2 * 1.4)[..., None] * np.exp(-np.abs(yn - horizon) * 9)[..., None]
        sky = sky + glow * np.array([0.10, 0.045, 0.02])
        glare = np.exp(-np.abs(yn - horizon) * 140)[..., None] * np.exp(-np.abs(xx / W - 0.5) * 2.5)[..., None]
        sky = sky + glare * np.array([0.35, 0.16, 0.06])
        below = smooth((yn - horizon) / 0.012)[..., None]
        sea = np.array([0.003, 0.0025, 0.007]) + glow * np.array([0.05, 0.022, 0.01]) * np.exp(-np.abs(yn - horizon) * 6)[..., None]
        sky = sky * (1 - below) + sea * below
        dawn = dawn ** 1.8
        bg = bg * (1 - dawn) + sky * dawn
    return bg

def post(hdr, t, W, H, exposure, hy=0.5):
    if exposure is None:
        exposure = np.interp(t, [0, 0.1, 0.22, 0.36, 0.5, 0.62, 0.75, 0.86, 0.95, 1.0],
                             [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0])
    img = hdr * exposure
    # bloom pyramid
    bloom = np.zeros_like(img)
    lum_src = np.maximum(img - 0.04, 0)
    for s, wgt in ((3, 0.16), (9, 0.12), (24, 0.09), (60, 0.07), (150, 0.06)):
        ds = max(1, int(s // 4))
        small = lum_src[::ds, ::ds]
        b = ndimage.gaussian_filter(small, sigma=(s / ds, s / ds, 0))
        b = upsample(b, ds, H, W) if ds > 1 else b
        bloom += b * wgt
    # anamorphic streak (very subtle)
    hi = np.maximum(img - 0.9, 0)[::4, ::4]
    st = ndimage.gaussian_filter1d(hi, sigma=W / 40 / 4, axis=1)
    st = upsample(st, 4, H, W)
    img = img + bloom + st * np.array([1.0, 0.75, 0.5]) * 0.35
    img = img + background(t, W, H, hy)
    # ACES filmic
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    img = np.clip((img * (a * img + b)) / (img * (c * img + d) + e), 0, 1)
    # grade: richer colour, cool shadows, warm highlights
    l = img.mean(-1, keepdims=True)
    img = np.clip(l + (img - l) * (1 + 0.4 * np.clip(l * 4, 0, 1)), 0, 1)
    img = img + (1 - l) ** 4 * np.array([0.0004, 0.0, 0.0012])
    # vignette
    yy, xx = np.mgrid[0:H, 0:W]
    u = (xx / W - 0.5) * 2; v = (yy / H - 0.5) * 2
    vig = 1 - 0.32 * (u * u * 0.6 + v * v * 0.8) ** 1.3
    img = img * np.clip(vig, 0, 1)[..., None]
    img = np.clip(img, 0, 1) ** (1 / 1.0)
    # gamma (approx sRGB) + dither to avoid banding
    img = np.power(img, 1 / 2.2)
    img = img * 255 + RNG.uniform(-1.0, 1.0, img.shape[:2])[..., None] + RNG.uniform(-0.5, 0.5, img.shape)
    return np.clip(img, 0, 255).astype(np.uint8)
