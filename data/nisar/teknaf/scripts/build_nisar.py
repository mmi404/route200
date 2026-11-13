import sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import earthaccess
sys.path.insert(0, "D:/race/nasaspace/route200/evidence/scripts")
import nisar_teknaf_pairs as P
os.chdir(os.path.dirname(os.path.abspath(__file__)))
earthaccess.login(strategy="netrc")
dates = ["2026-06-25", "2026-06-30", "2026-07-12", "2026-07-19", "2026-07-24"]
cmap_lo, cmap_hi = -25.0, 0.0
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 30)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
frames = []
for d in dates:
    db, px = P.load(d)
    np.save(f"hh_db_{d}.npy", db)
    print(d, db.shape, px, flush=True)
    g = np.clip((np.nan_to_num(db, nan=cmap_lo) - cmap_lo) / (cmap_hi - cmap_lo), 0, 1)
    g = (g * 255).astype(np.uint8)
    im = Image.fromarray(g, "L").convert("RGB")
    im = im.resize((800, int(800 * im.height / im.width)))
    track = P.GR[d].split("_")
    orbit = "pass " + track[4] + " " + ("ascending" if track[7] == "A" else "descending")
    dr = ImageDraw.Draw(im, "RGBA")
    dr.rectangle([0, 0, im.width, 60], fill=(0, 0, 0, 150))
    dr.text((14, 10), d, font=font, fill="white")
    dr.text((14, 42), "NISAR GCOV HH, 10 m, " + orbit, font=small, fill="white")
    frames.append(im)
    im.save(f"frame_{d}.png")
w = frames[0].width; h = frames[0].height
print("frame size", w, h)
