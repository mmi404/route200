import os, glob
from PIL import Image, ImageDraw, ImageFont
os.chdir(os.path.dirname(os.path.abspath(__file__)))
font = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 34)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 20)
names = []
for d in range(1, 26):
    t = f"2026-07-{d:02d}"
    src = None
    if os.path.getsize(f"gibs_{t}.jpg") > 15000:
        src = f"gibs_{t}.jpg"
    elif os.path.exists(f"viirs_{t}.jpg") and os.path.getsize(f"viirs_{t}.jpg") > 4100:
        src = f"viirs_{t}.jpg"
    if not src:
        print("gap", t); continue
    im = Image.open(src).convert("RGB").resize((800, 800))
    dr = ImageDraw.Draw(im, "RGBA")
    dr.rectangle([0, 0, 800, 64], fill=(0, 0, 0, 150))
    dr.text((16, 12), t, font=font, fill="white")
    lab = "NASA GIBS true colour (" + ("MODIS Terra" if src.startswith("gibs") else "VIIRS SNPP") + ")"
    w = dr.textlength(lab, font=small)
    dr.text((800 - w - 16, 24), lab, font=small, fill="white")
    out = f"frames/f_{t}.png"; im.save(out); names.append(out)
    print(t, "<-", src)
with open("list.txt", "w") as f:
    for n in names:
        f.write(f"file '{n}'\nduration 1\n")
    f.write(f"file '{names[-1]}'\n")
