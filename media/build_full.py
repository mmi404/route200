import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
os.chdir(ROOT)
W, H = 1920, 1080
big = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 56)
med = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 36)


def label(im, top, bottom):
    d = ImageDraw.Draw(im, "RGBA")
    d.rectangle([0, 0, W, 110], fill=(0, 0, 0, 160))
    d.text((40, 16), top, font=big, fill="white")
    d.text((40, 72), bottom, font=med, fill="white")
    return im


def fill(im):
    # zoom-to-fill: centre-crop to 16:9, then upscale to the frame size
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


def write_list(path, names, dur):
    with open(path, "w") as f:
        for n in names:
            f.write("file '" + os.path.basename(n) + "'\n")
            f.write("duration " + str(dur) + "\n")
        f.write("file '" + os.path.basename(names[-1]) + "'\n")


# GIBS: same day selection as build_gibs.py
gnames = []
for d in range(1, 26):
    t = "2026-07-%02d" % d
    if os.path.getsize("gibs/gibs_%s.jpg" % t) > 15000:
        src, srcname = "gibs/gibs_%s.jpg" % t, "MODIS Terra"
    elif os.path.exists("gibs/viirs_%s.jpg" % t) and os.path.getsize("gibs/viirs_%s.jpg" % t) > 4100:
        src, srcname = "gibs/viirs_%s.jpg" % t, "VIIRS SNPP"
    else:
        continue
    im = label(fill(Image.open(src).convert("RGB")), t,
               "NASA GIBS true colour, " + srcname + ", Chattogram Hill Tracts")
    out = "full/g_%s.png" % t
    im.save(out)
    gnames.append(out)

# NISAR: HH backscatter, the same five dates
info = {
    "2026-06-25": "track 163 descending",
    "2026-06-30": "track 69 ascending",
    "2026-07-12": "track 69 ascending",
    "2026-07-19": "track 163 descending",
    "2026-07-24": "track 69 ascending",
}
nnames = []
for d in info:
    db = np.load("nisar/hh_db_%s.npy" % d)
    g = (np.clip((np.nan_to_num(db, nan=-25.0) + 25.0) / 25.0, 0, 1) * 255).astype(np.uint8)
    im = label(fill(Image.fromarray(g, "L").convert("RGB")), d,
               "NISAR GCOV HH backscatter, 10 m, " + info[d] + ", Teknaf")
    out = "full/n_%s.png" % d
    im.save(out)
    nnames.append(out)

write_list("full/gibs_list.txt", gnames, 1)
write_list("full/nisar_list.txt", nnames, 2)
print(len(gnames), len(nnames))
