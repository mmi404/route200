from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = "D:/race/nasaspace/video/animations/full/n_2026-07-12.png"
OUT = "D:/race/nasaspace/video/2nd phase/final/thumbnail_1280x720.jpg"
W, H = 1280, 720

bg = Image.open(SRC).convert("RGB").resize((W, H), Image.LANCZOS)
bg = bg.filter(ImageFilter.GaussianBlur(1.2)).convert("RGBA")

# dark gradient on the left so the text stays readable
shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shade)
for x in range(0, W, 2):
    a = int(235 * max(0.0, 1 - x / 820))
    sd.rectangle([x, 0, x + 1, H], fill=(8, 12, 18, a))
img = Image.alpha_composite(bg, shade)

d = ImageDraw.Draw(img)
big = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 150)
mid = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 66)
sm = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 40)
d.text((60, 70), "404", font=big, fill=(120, 170, 200, 255))
d.text((60, 225), "to  200 OK", font=mid, fill=(255, 255, 255, 255))
d.rectangle([60, 330, 300, 340], fill=(0, 160, 200, 255))
d.text((60, 370), "Route200", font=mid, fill=(255, 255, 255, 255))
d.text((60, 455), "Radar alerts for landslides", font=sm, fill=(225, 235, 240, 255))
d.text((60, 505), "and riverbank erosion in Bangladesh", font=sm, fill=(225, 235, 240, 255))
d.text((60, 620), "CUET_404  |  NASA Space Apps 2026", font=sm, fill=(170, 200, 215, 255))

img.convert("RGB").save(OUT, "JPEG", quality=92)
print("saved", OUT)
