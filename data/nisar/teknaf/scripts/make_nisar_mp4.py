import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.abspath(__file__)))
GR = {
 "2026-06-25": "NISAR_L2_PR_GCOV_023_163_D_078_4005",
 "2026-06-30": "NISAR_L2_PR_GCOV_024_069_A_012_4005",
 "2026-07-12": "NISAR_L2_PR_GCOV_025_069_A_012_4005",
 "2026-07-19": "NISAR_L2_PR_GCOV_025_163_D_078_4005",
 "2026-07-24": "NISAR_L2_PR_GCOV_026_069_A_012_4005",
}
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 30)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 18)
lo, hi = -25.0, 0.0
names = []
for d, nm in GR.items():
    db = np.load(f"hh_db_{d}.npy")
    g = (np.clip((np.nan_to_num(db, nan=lo) - lo) / (hi - lo), 0, 1) * 255).astype(np.uint8)
    im = Image.fromarray(g, "L").convert("RGB").resize((800, 800))
    p = nm.split("_")
    orbit = f"track {int(p[5])}, {'ascending' if p[6]=='A' else 'descending'}"
    dr = ImageDraw.Draw(im, "RGBA")
    dr.rectangle([0, 0, 800, 60], fill=(0, 0, 0, 150))
    dr.text((14, 8), d, font=font, fill="white")
    dr.text((14, 40), f"NISAR GCOV HH backscatter, 10 m, {orbit}", font=small, fill="white")
    out = f"frame_{d}.png"; im.save(out); names.append(out)
with open("list.txt", "w") as f:
    for n in names:
        f.write(f"file '{n}'\nduration 2\n")
    f.write(f"file '{names[-1]}'\n")
print("ok")
