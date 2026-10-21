import sys, os, time, numpy as np
from PIL import Image
import film
mode, W, H, count, part, parts, outdir, q = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), int(sys.argv[6]), sys.argv[7], int(sys.argv[8])
os.makedirs(outdir, exist_ok=True)
for i in range(part, count, parts):
    out = f"{outdir}/f{i:03d}.webp"
    if os.path.exists(out) and '--force' not in sys.argv: continue
    t = i / (count - 1)
    t0 = time.time()
    if mode == 'landscape':
        off = (float(np.interp(t, [0, 0.86, 0.94, 1], [0.12, 0.12, 0.0, 0.0])), 0.0)
    else:
        off = (0.0, float(np.interp(t, [0, 0.86, 0.94, 1], [-0.12, -0.12, -0.02, -0.02])))
    im = film.render(t, W, H, mode, frame_offset=off)
    Image.fromarray(im).save(out, quality=q, method=4)
    print(f"{i} {time.time()-t0:.1f}s", flush=True)
