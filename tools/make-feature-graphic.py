# -*- coding: utf-8 -*-
"""Play feature graphic (1024x500, RGB) from the blue CICT artwork.

Tamil is composited from the artwork (this Pillow cannot shape Tamil); the
Latin strapline is live text in a face verified to carry Ā, Ṇ and Ṟ. The ground
is the artwork's own blue, so crops paste straight on without any matte.
"""
import sys, io, pathlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = Image.open(r"D:\Tolkappiyam app\tholkappiyam-android\store\artwork-blue-512.png").convert("RGB")
OUT = pathlib.Path(r"D:\Tolkappiyam app\tholkappiyam-android\store\play-feature-graphic-1024x500.png")
W, H, M = 1024, 500, 70
BLUE = (0x18, 0x00, 0xAD)
GOLD = (236, 200, 140)
CREAM = (214, 208, 232)

def blue_key(img, blur=0.5):
    """Alpha matte dropping the artwork's blue ground (not perfectly flat)."""
    m = Image.new("L", img.size, 0); mp, ip = m.load(), img.load()
    for yy in range(img.height):
        for xx in range(img.width):
            r, g, b = ip[xx, yy]
            mp[xx, yy] = 0 if (b > 90 and r < 110 and g < 90 and b > r + 40) else 255
    return m.filter(ImageFilter.GaussianBlur(blur))

def gold_key(img, blur=0.6):
    m = Image.new("L", img.size, 0); mp, ip = m.load(), img.load()
    for yy in range(img.height):
        for xx in range(img.width):
            r, g, b = ip[xx, yy]
            mp[xx, yy] = 255 if (r > 100 and b < r * 0.68) else 0
    return m.filter(ImageFilter.GaussianBlur(blur))

bg = Image.new("RGB", (W, H), BLUE)
d = ImageDraw.Draw(bg)
# gentle deepening to the right so the figure has weight
for x in range(W):
    t = x / (W - 1)
    d.line([(x, 0), (x, H)], fill=(int(BLUE[0] - 6 * t), 0, int(BLUE[2] - 34 * t)))

# manuscript strip at the foot (the artwork's palm leaf), dimmed into the blue
STRIP = 64
man = SRC.crop((0, 396, 512, 505)).resize((W, int(109 * W / 512)), Image.LANCZOS)
man = man.crop((0, man.height - STRIP, W, man.height))
fade = Image.new("L", (W, STRIP)); fd = ImageDraw.Draw(fade)
for y in range(STRIP):
    fd.line([(0, y), (W, y)], fill=int(118 * (y / STRIP) ** 1.4))
bg.paste(man, (0, H - STRIP), fade)

# statue (right), with the AI bubble region blanked to blue and a base fade
st = SRC.crop((270, 190, 450, 454)).copy()   # wider than the black version; stop above the manuscript
_sd = ImageDraw.Draw(st)
_sd.rectangle((int(st.width * .72), 0, st.width, int(st.height * .22)), fill=BLUE)   # AI bubble
_sd.rectangle((0, 0, int(st.width * .22), int(st.height * .36)), fill=BLUE)          # its tail, top-left
_sd.rectangle((0, int(st.height * .18), int(st.width * .10), int(st.height * .56)), fill=BLUE)  # the T of CICT
SH = 418; SW = int(st.width * SH / st.height)
st = st.resize((SW, SH), Image.LANCZOS)
# The blue-version figure has blue-tinted shadows, so a gold *inclusion* key
# punches holes in the folds; drop the ground instead.
sm = blue_key(st, 0.7); smp = sm.load()
for i in range(50):
    yy = st.height - 1 - i; k = (i / 50) ** 0.8
    for x in range(st.width): smp[x, yy] = int(smp[x, yy] * k)
bg.paste(st, (W - M - SW, H - STRIP - SH + 40), sm)

# Tamil title lifted from the artwork
title = SRC.crop((26, 40, 450, 164))
TW = 490; title = title.resize((TW, int(title.height * TW / title.width)), Image.LANCZOS)
tm = blue_key(title); tmp, tp = tm.load(), title.load()
for yy in range(title.height):
    for xx in range(title.width):
        r, g, b = tp[xx, yy]
        if r > 150 and g > 110 and b < 110: tmp[xx, yy] = 0   # gold = the crown, not title
TY = 70; bg.paste(title, (M - 6, TY), tm)
y = TY + title.height + 18

# Latin strapline, glyphs verified
def font(names, size):
    for n in names:
        try: return ImageFont.truetype("C:/Windows/Fonts/" + n, size)
        except OSError: continue
    return ImageFont.load_default()
ROMAN = "TOLK\u0100PPIYA NU\u1E46\u1E46A\u1E5EIVU"
f1 = font(["segoeuib.ttf", "arialbd.ttf"], 25); f2 = font(["segoeui.ttf", "arial.ttf"], 20)
def _bmp(f, ch): m = f.getmask(ch, mode="L"); return (m.size, bytes(m))
_t = _bmp(f1, "\ue000")
assert not [c for c in ROMAN if c.strip() and _bmp(f1, c) == _t], "tofu in strapline"
d = ImageDraw.Draw(bg)
x = M
for ch in ROMAN:
    d.text((x, y), ch, font=f1, fill=GOLD); x += f1.getlength(ch) + 2.6
y += 37
d.text((M, y), "The complete Tolkappiyam \u2014 text, commentary, recitation and practice", font=f2, fill=CREAM)
y += 35
for i, c in enumerate([(255, 153, 51), (245, 245, 245), (19, 136, 8)]):
    d.rectangle((M + i * 56, y, M + i * 56 + 54, y + 4), fill=c)
y += 23

# CICT lockup from the artwork
lock = SRC.crop((32, 212, 290, 336))
LW = 190; lock = lock.resize((LW, int(lock.height * LW / lock.width)), Image.LANCZOS)
bg.paste(lock, (M - 2, y), blue_key(lock))
lock_bottom = y + lock.height
assert lock_bottom < H - STRIP + 14, ("lockup collides with strip", lock_bottom)
assert W - M - SW > M + 520, "statue overlaps text column"

bg.save(OUT, optimize=True)
print("wrote", OUT.name, bg.size, bg.mode, "%.0f KB" % (OUT.stat().st_size / 1024),
      "| title..%d strapline %d lockup..%d strip %d" % (TY + title.height, TY + title.height + 18, lock_bottom, H - STRIP))
