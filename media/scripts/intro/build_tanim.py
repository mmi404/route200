import subprocess, wave, numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "D:/race/nasaspace/video/2nd phase/"
OUT = SRC + "intro_named/"
W, H = 1920, 1080
SR = 44100
ACCENT = (0, 77, 115, 255)
BG = (14, 14, 14, 232)
name_f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 64)
role_f = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 38)

# Each card is centred on a large transparent canvas before rotating, so the
# 15 degree turn pivots on the card's own centre and nothing is cropped.
CW, CH = 1100, 300
LEFT = 80                # screen x of every card's left edge
NAME_CY = H - 340        # screen y of the name card's centre
ROLE_CY = H - 230        # screen y of the designation card's centre
SLIDE_S = 0.5
A = 0.6                  # name card starts rising
ROLE_A = A + 0.45        # designation card starts a little later

people = [("3", "Tanim", "Web & ML")]


def card(text, font, pad_x, pad_y, path):
    d0 = ImageDraw.Draw(Image.new("RGBA", (10, 10)))
    tw = int(d0.textlength(text, font=font))
    w = tw + pad_x * 2 + 14
    h = font.size + pad_y * 2
    box = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(box)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=10, fill=BG)
    d.rectangle([0, 0, 13, h - 1], fill=ACCENT)
    d.text((pad_x + 14, pad_y - 6), text, font=font, fill=(255, 255, 255, 255))
    canvas = Image.new("RGBA", (CW, CH), (0, 0, 0, 0))
    canvas.paste(box, ((CW - w) // 2, (CH - h) // 2), box)
    canvas = canvas.rotate(15, resample=Image.BICUBIC, center=(CW / 2, CH / 2))
    canvas.save(path)
    return w


def sfx():
    n = int(0.8 * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(1).standard_normal(n)
    out = np.zeros(n)
    y = 0.0
    for i in range(n):
        f = 0.02 + 0.25 * (i / n) ** 2
        y = y + f * (noise[i] - y)
        out[i] = y
    whoosh = out * (np.sin(np.pi * t / 0.8) ** 1.5)
    whoosh = whoosh / np.max(np.abs(whoosh)) * 0.6
    with wave.open(OUT + "whoosh.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(whoosh, -1, 1) * 32767).astype("<i2").tobytes())


def dur(p):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]
    ).decode().strip())


def slide_expr(start, target_top):
    # starts below the bottom edge of the frame, rises with ease-out, then holds
    s0 = H + 20
    p = "min(1,max(0,(t-" + str(start) + ")/" + str(SLIDE_S) + "))"
    return str(s0) + "-(" + str(s0) + "-" + str(target_top) + ")*(1-(1-" + p + ")*(1-" + p + "))"


sfx()
for num, name, role in people:
    src = SRC + num + ".mp4"
    d = dur(src)
    nw = card(name, name_f, 36, 22, OUT + "name_" + name + ".png")
    rw = card(role, role_f, 30, 16, OUT + "role_" + name + ".png")
    # canvas placement: card centre lands on (LEFT + w/2, centre y)
    nx = LEFT + nw / 2 - CW / 2
    rx = LEFT + rw / 2 - CW / 2
    ny = NAME_CY - CH / 2
    ry = ROLE_CY - CH / 2
    fc = ("[0:v]scale={W}:{H},setsar=1[bg];"
          "[1:v]format=rgba[nc];[2:v]format=rgba[rc];"
          "[bg][nc]overlay=x={nx}:y='{ye}':eval=frame[t1];"
          "[t1][rc]overlay=x={rx}:y='{yr}':eval=frame[v];"
          "[3:a]adelay={wd}|{wd}[w];"
          "[0:a][w]amix=inputs=2:normalize=0:dropout_transition=0[a]").format(
        W=W, H=H, nx=round(nx), rx=round(rx),
        ye=slide_expr(A, ny), yr=slide_expr(ROLE_A, ry),
        wd=int((A - 0.3) * 1000))
    out = OUT + "intro_" + num + "_" + name + ".mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src,
                    "-loop", "1", "-i", OUT + "name_" + name + ".png",
                    "-loop", "1", "-i", OUT + "role_" + name + ".png",
                    "-i", OUT + "whoosh.wav",
                    "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-t", str(d), "-c:v", "libx264", "-crf", "20", "-preset", "medium",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out], check=True)
    print(out, round(dur(out), 2))
