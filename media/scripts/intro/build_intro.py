import subprocess, wave, numpy as np
from PIL import Image, ImageDraw, ImageFont

SRC = "D:/race/nasaspace/video/2nd phase/"
OUT = SRC + "intro_named/"
W, H, BAND = 1920, 1080, 210
SR = 44100
ACCENT = (0, 77, 115)

name_f = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 72)
role_f = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 42)

people = [
    ("1", "Mahi", "Lead"),
    ("2", "Raisa", "Research & Strategy"),
    ("4", "Faladun", "Systems & Alerts"),
    ("5", "Talha", "Creative Lead"),
    ("6", "Arik", "Video Production"),
]

def card(name, role, path):
    im = Image.new("RGBA", (W, BAND), (14, 14, 14, 228))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 14, BAND], fill=ACCENT + (255,))
    d.text((70, 40), name, font=name_f, fill=(255, 255, 255, 255))
    d.text((70, 128), role, font=role_f, fill=(200, 220, 230, 255))
    im.save(path)

def sfx():
    # whoosh: band-passed noise sweeping up, with a fade in and out
    n = int(0.8 * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(1).standard_normal(n)
    out = np.zeros(n)
    y = 0.0
    for i in range(n):
        f = 0.02 + 0.25 * (i / n) ** 2
        y = y + f * (noise[i] - y)
        out[i] = y
    env = np.sin(np.pi * t / 0.8) ** 1.5
    whoosh = out * env
    whoosh = whoosh / np.max(np.abs(whoosh)) * 0.6
    # pop: short sine with fast decay and a click
    m = int(0.3 * SR)
    tp = np.arange(m) / SR
    pop = np.sin(2 * np.pi * (900 * np.exp(-tp * 12) + 180) * tp) * np.exp(-tp * 22)
    pop = pop / np.max(np.abs(pop)) * 0.8
    for name, arr in [("whoosh", whoosh), ("pop", pop)]:
        with wave.open(OUT + name + ".wav", "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((np.clip(arr, -1, 1) * 32767).astype("<i2").tobytes())

sfx()
for num, name, role in people:
    card(name, role, OUT + "band_" + name + ".png")

def dur(p):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p]).decode().strip())

A = 0.6  # slide-in starts
SLIDE = 0.45
for num, name, role in people:
    src = SRC + num + ".mp4"
    d = dur(src)
    B = min(A + 4.5, d - 0.9)  # slide-out start
    y0 = H - BAND - 60
    y_expr = ("if(lt(t,{A}),{H},if(lt(t,{A1}),{H}-({H}-{Y0})*(t-{A})/{S},"
              "if(lt(t,{B}),{Y0},if(lt(t,{B1}),{Y0}+({H}-{Y0})*(t-{B})/{S},{H}))))"
              ).format(A=A, A1=A + SLIDE, H=H, Y0=y0, S=SLIDE, B=B, B1=B + SLIDE)
    fc = ("[0:v]scale={W}:{H},setsar=1[bg];[1:v]format=rgba[band];"
          "[bg][band]overlay=x=0:y='{y}':eval=frame[v];"
          "[2:a]adelay={wd}|{wd}[w];[3:a]adelay={pd}|{pd}[p];"
          "[0:a][w][p]amix=inputs=3:normalize=0:dropout_transition=0[a]").format(
        W=W, H=H, y=y_expr, wd=int((A - 0.3) * 1000), pd=int((A + SLIDE) * 1000))
    out = OUT + "intro_" + num + "_" + name + ".mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src,
                    "-loop", "1", "-i", OUT + "band_" + name + ".png",
                    "-i", OUT + "whoosh.wav", "-i", OUT + "pop.wav",
                    "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                    "-t", str(d), "-c:v", "libx264", "-crf", "20", "-preset", "medium",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out], check=True)
    print(out, round(dur(out), 2))
