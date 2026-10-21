"""Cinematic grade for the Vyana Soul film.

Turns the source video toward the site's look: deep indigo-black shadows,
gold highlights, tamed cyan/blue, soft bloom so the light glows, gentle
contrast, a touch of sharpening and a vignette. Deterministic per frame,
so there is no flicker between frames.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

INK = np.array([8, 6, 15]) / 255.0

def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

def grade(img):
    x = img.astype(np.float32) / 255.0
    H, W, _ = x.shape
    # --- mild sharpening (the source is soft) --------------------------------
    blur = ndimage.gaussian_filter(x, sigma=(1.3, 1.3, 0))
    x = np.clip(x + 0.45 * (x - blur), 0, 1)

    # --- colour: work in YCbCr (gamma space) ----------------------------------
    r, g, b = x[..., 0], x[..., 1], x[..., 2]
    Y = 0.299 * r + 0.587 * g + 0.114 * b
    Cb = -0.168736 * r - 0.331264 * g + 0.5 * b
    Cr = 0.5 * r - 0.418688 * g - 0.081312 * b
    # tame cyan/blue (the "rendered" part of the nebula and the cold haze)
    blueish = smoothstep(-0.01, 0.10, Cb) * smoothstep(0.04, -0.06, Cr)
    Cb = Cb * (1 - 0.42 * blueish)
    Cr = Cr + 0.085 * blueish            # turn the cyan toward indigo-violet, not green
    # global chroma: a little less, so the gold reads as light, not paint
    Cb *= 0.82; Cr *= 0.92
    # tone curve on luma: deeper blacks, soft shoulder
    Yc = np.clip((Y - 0.05) / 0.95, 0, 1)
    Yc = Yc ** 1.22
    Yc = Yc + 0.22 * Yc * (1 - Yc) * (Yc - 0.3)    # S-curve for depth
    # bright, washed frames (the final radiant book) get pulled back to rich gold
    mean = float(Yc.mean())
    if mean > 0.42:
        k = min(1.0, (mean - 0.42) / 0.2)
        Yc = Yc ** (1 + 0.35 * k)
    Yc = 1 - (1 - Yc) ** 1.04
    # split tone: indigo in shadows, warm gold in highlights
    sh = (1 - smoothstep(0.0, 0.35, Yc))
    hi = smoothstep(0.55, 1.0, Yc)
    mid = smoothstep(0.25, 0.6, Yc) * (1 - hi)
    Cb = Cb + 0.030 * sh - 0.045 * hi - 0.018 * mid
    Cr = Cr + 0.012 * sh + 0.028 * hi + 0.012 * mid
    r = Yc + 1.402 * Cr
    g = Yc - 0.344136 * Cb - 0.714136 * Cr
    b = Yc + 1.772 * Cb
    x = np.clip(np.stack([r, g, b], -1), 0, 1)

    # --- bloom on the light ---------------------------------------------------
    lin = x ** 2.2
    lum = lin @ np.array([0.2126, 0.7152, 0.0722])
    src = lin * smoothstep(0.35, 0.9, lum)[..., None]
    bloom = np.zeros_like(lin)
    for s, wgt, ds in ((5, 0.34, 1), (20, 0.26, 4), (70, 0.15, 8)):
        small = src[::ds, ::ds]
        bl = ndimage.gaussian_filter(small, sigma=(s / ds, s / ds, 0))
        bl = ndimage.zoom(bl, (H / bl.shape[0], W / bl.shape[1], 1), order=1)[:H, :W]
        bloom += bl * wgt
    lin = lin + bloom * np.array([1.0, 0.82, 0.58])
    # soft highlight roll-off so bloom never clips harshly
    lin = lin / (1 + 0.22 * lin)
    x = np.clip(lin * 1.15, 0, 1) ** (1 / 2.2)

    # --- vignette and lift blacks to the page colour ------------------------------
    yy, xx = np.mgrid[0:H, 0:W]
    u = (xx / W - 0.5) * 2; v = (yy / H - 0.5) * 2
    vig = 1 - 0.42 * np.clip(u * u * 0.55 + v * v * 0.75, 0, 1.6) ** 1.2
    x = x * vig[..., None]
    x = np.maximum(x, INK * (1 - smoothstep(0.0, 0.08, x.mean(-1, keepdims=True))))
    out = np.clip(x * 255 + np.random.default_rng(7).uniform(-0.6, 0.6, x.shape), 0, 255)
    return out.astype(np.uint8)

def phone_crop(img, outW=810, outH=1440):
    H, W, _ = img.shape
    cw = int(round(H * outW / outH))
    x0 = (W - cw) // 2
    crop = Image.fromarray(img[:, x0:x0 + cw])
    return crop.resize((outW, outH), Image.LANCZOS)

if __name__ == "__main__":
    src_dir, out_dir, part, parts = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    os.makedirs(f"{out_dir}/desktop", exist_ok=True)
    os.makedirs(f"{out_dir}/mobile", exist_ok=True)
    files = sorted(f for f in os.listdir(src_dir) if f.endswith(".png"))
    for i, f in enumerate(files):
        if i % parts != part:
            continue
        g = grade(np.asarray(Image.open(f"{src_dir}/{f}").convert("RGB")))
        Image.fromarray(g).save(f"{out_dir}/desktop/f{i:03d}.webp", quality=86, method=4)
        phone_crop(g).save(f"{out_dir}/mobile/f{i:03d}.webp", quality=84, method=4)
        print(i, flush=True)
