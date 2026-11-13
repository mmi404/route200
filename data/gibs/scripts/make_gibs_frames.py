"""Label the raw GIBS tiles and write the frames and concat list for the video.

Reads data/gibs/raw/ (written by fetch_gibs_july.py), writes data/gibs/frames/
and data/gibs/list.txt. Days with no usable tile are reported and left out.

Requires Pillow and a Windows arial font. Adjust FONT_DIR on other systems.
"""
import os

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, ".."))
RAW = os.path.join(DATA, "raw")
FRAMES = os.path.join(DATA, "frames")
MODIS_MIN_BYTES = 15000
VIIRS_MIN_BYTES = 4100
FONT_DIR = "C:/Windows/Fonts"


def main():
    font = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 34)
    small = ImageFont.truetype(os.path.join(FONT_DIR, "arial.ttf"), 20)
    os.makedirs(FRAMES, exist_ok=True)
    names = []
    for d in range(1, 26):
        t = f"2026-07-{d:02d}"
        src = None
        m = os.path.join(RAW, f"gibs_{t}.jpg")
        v = os.path.join(RAW, f"viirs_{t}.jpg")
        if os.path.exists(m) and os.path.getsize(m) > MODIS_MIN_BYTES:
            src = m
            label = "NASA GIBS true colour (MODIS Terra)"
        elif os.path.exists(v) and os.path.getsize(v) > VIIRS_MIN_BYTES:
            src = v
            label = "NASA GIBS true colour (VIIRS SNPP)"
        if src is None:
            print("gap", t)
            continue
        im = Image.open(src).convert("RGB").resize((800, 800))
        dr = ImageDraw.Draw(im, "RGBA")
        dr.rectangle([0, 0, 800, 64], fill=(0, 0, 0, 150))
        dr.text((16, 12), t, font=font, fill="white")
        w = dr.textlength(label, font=small)
        dr.text((800 - w - 16, 24), label, font=small, fill="white")
        rel = f"frames/f_{t}.png"
        im.save(os.path.join(DATA, rel))
        names.append(rel)
        print(t, "<-", os.path.basename(src))
    with open(os.path.join(DATA, "list.txt"), "w") as f:
        for n in names:
            f.write(f"file '{n}'\nduration 1\n")
        f.write(f"file '{names[-1]}'\n")
    print("frames", len(names))


if __name__ == "__main__":
    main()
