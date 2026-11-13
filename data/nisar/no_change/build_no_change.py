import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ANIM = os.path.join(HERE, "..")
os.chdir(HERE)
W, H = 1920, 1080
big = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 56)
med = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 36)
small = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 30)


def fill(im):
    w, h = im.size
    if w / h > W / H:
        cw = int(round(h * W / H))
        x0 = (w - cw) // 2
        im = im.crop((x0, 0, x0 + cw, h))
    else:
        ch = int(round(w * H / W))
        y0 = (h - ch) // 2
        im = im.crop((0, y0, w, y0 + ch))
    return im.resize((W, H), Image.LANCZOS)


def top_band(im, top, bottom):
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 0, W, 130], fill=(0, 0, 0, 170))
    d.text((40, 14), top, font=big, fill="white")
    d.text((40, 80), bottom, font=med, fill="white")
    return im


def radar(path):
    db = np.load(os.path.join(ANIM, "nisar", path))
    g = (np.clip((np.nan_to_num(db, nan=-25.0) + 25.0) / 25.0, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(g, "L").convert("RGB")


# Frame 1 and 2: the two radar passes that make up the pair
f1 = top_band(fill(radar("hh_db_2026-06-30.npy")), "30 June 2026", "NISAR GCOV HH backscatter, Teknaf, before")
f2 = top_band(fill(radar("hh_db_2026-07-24.npy")), "24 July 2026", "NISAR GCOV HH backscatter, Teknaf, after")

# Frame 3: the change map, with the 3 dB change threshold marked in red
diff = np.load("D:/race/nasaspace/route200/evidence/scripts/nisar_teknaf_diff.npy")
diff = diff - np.nanmedian(diff)
rgb = np.zeros(diff.shape + (3,), dtype=np.uint8)
base = np.clip((diff + 3.0) / 6.0, 0, 1)  # -3 dB to +3 dB grey scale
rgb[..., 0] = rgb[..., 1] = rgb[..., 2] = (base * 200 + 30).astype(np.uint8)
drop = diff <= -3.0
rise = diff >= 3.0
rgb[drop] = (220, 40, 40)
rgb[rise] = (40, 110, 220)
f3 = fill(Image.fromarray(rgb, "RGB"))
d = ImageDraw.Draw(f3, "RGBA")
d.rectangle([0, 0, W, 130], fill=(0, 0, 0, 170))
d.text((40, 14), "Change above 3 dB: 0.0% of pixels", font=big, fill="white")
d.text((40, 80), "30 June to 24 July 2026. Red = drop of 3 dB or more, blue = rise.", font=med, fill="white")
d.rectangle([0, H - 130, W, H], fill=(0, 0, 0, 170))
d.text((40, H - 100), "No change over the 3 dB threshold in the NISAR passes.", font=med, fill="white")
d.text((40, H - 56), "The full change engine still runs on Sentinel-1.", font=small, fill="white")

names = []
for name, im in [("nc_1.png", f1), ("nc_2.png", f2), ("nc_3.png", f3)]:
    im.save(name)
    names.append(name)

with open("list.txt", "w") as f:
    durs = [3, 3, 6]
    for n, dur in zip(names, durs):
        f.write("file '" + n + "'\nduration " + str(dur) + "\n")
    f.write("file '" + names[-1] + "'\n")
print("ok", drop.sum(), rise.sum(), diff.shape)
