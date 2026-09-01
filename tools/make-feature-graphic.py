# -*- coding: utf-8 -*-
"""Google Play feature graphic — 1024x500, RGB, no alpha.

The Tamil title is composited from CICT's own artwork rather than typeset: this
Pillow build has no Raqm/HarfBuzz, so it cannot reorder Tamil vowel signs and
would render தொ wrongly. Cropping the rendered title keeps the letterforms exact.
Only the Latin strapline is set as live text, in Segoe UI Semibold — one of the
few faces here that actually carries Ā, Ṇ and Ṟ rather than substituting tofu.
"""
import sys, io, pathlib
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SRC = Image.open(r"C:\Users\Kannan\Downloads\Tol.png").convert("RGB")
W, H = 1024, 500
M = 70                      # side margin; Play may crop the outer edge
OCHRE = (228, 188, 120)
CREAM = (198, 188, 166)

# ---- ground -----------------------------------------------------------------
bg = Image.new("RGB", (W, H))
d = ImageDraw.Draw(bg)
for x in range(W):
    t = x / (W - 1)
    d.line([(x, 0), (x, H)],
           fill=(int(20 - 9 * t), int(35 - 18 * t), int(64 - 33 * t)))

# ---- manuscript strip at the foot, heavily dimmed ---------------------------
STRIP = 62
man = SRC.crop((0, 392, 512, 505))
man = man.resize((W, int(man.height * W / 512)), Image.LANCZOS)
man = man.crop((0, man.height - STRIP, W, man.height))
fade = Image.new("L", (W, STRIP))
fd = ImageDraw.Draw(fade)
for y in range(STRIP):
    fd.line([(0, y), (W, y)], fill=int(96 * (y / STRIP) ** 1.5))
bg.paste(man, (0, H - STRIP), fade)


def cutout(img, thresh=34, blur=0.6):
    """Alpha matte that drops the artwork's black ground."""
    m = Image.new("L", img.size, 0)
    mp, ip = m.load(), img.load()
    for y in range(img.height):
        for x in range(img.width):
            r, g, b = ip[x, y]
            mp[x, y] = 0 if (r < thresh and g < thresh and b < thresh) else 255
    return m.filter(ImageFilter.GaussianBlur(blur))


# ---- statue -----------------------------------------------------------------
st = SRC.crop((288, 196, 435, 470)).copy()
ImageDraw.Draw(st).rectangle(
    (int(st.width * .70), 0, st.width, int(st.height * .24)), fill=(0, 0, 0))
sp = st.load()
for y in range(st.height):
    for x in range(st.width):
        r, g, b = sp[x, y]
        if not (r > 100 and b < r * 0.68):        # keep saturated gold only
            sp[x, y] = (0, 0, 0)
SH = 412
SW = int(st.width * (SH / st.height))
st = st.resize((SW, SH), Image.LANCZOS)
sx, sy = W - M - SW, H - STRIP - SH + 34
# The pedestal sits on the manuscript in the source, so knocking out the
# non-gold leaves a torn edge at its base. Ramp the mask to zero over the last
# rows so the figure settles into the ground instead of ending on a rag.
smask = cutout(st)
smp = smask.load()
FADE = 54
for i in range(FADE):
    yy = st.height - 1 - i
    k = (i / FADE) ** 0.8
    for x in range(st.width):
        smp[x, yy] = int(smp[x, yy] * k)
bg.paste(st, (sx, sy), smask)

# ---- Tamil title (composited, not typeset) ----------------------------------
title = SRC.crop((26, 42, 466, 176))
TW = 496
title = title.resize((TW, int(title.height * (TW / title.width))), Image.LANCZOS)
TITLE_Y = 74
bg.paste(title, (M - 4, TITLE_Y), cutout(title, 40, 0.5))
title_bottom = TITLE_Y + title.height

# ---- Latin strapline --------------------------------------------------------
def font(names, size):
    for n in names:
        try:
            return ImageFont.truetype("C:/Windows/Fonts/" + n, size)
        except OSError:
            continue
    return ImageFont.load_default()

ROMAN = "TOLKĀPPIYA NUṆṆAṞIVU"
f1 = font(["segoeuib.ttf", "arialbd.ttf", "timesbd.ttf"], 25)
# A missing glyph silently becomes a tofu box. Advance width is not a reliable
# tell (plenty of real glyphs share the tofu's width), so compare rendered
# bitmaps against a private-use codepoint that is guaranteed absent.
def _bmp(f, ch):
    m = f.getmask(ch, mode="L")
    return (m.size, bytes(m))
_tofu = _bmp(f1, "")
_bad = sorted({c for c in ROMAN if c.strip() and _bmp(f1, c) == _tofu})
assert not _bad, "font lacks glyphs for: %r" % _bad
f2 = font(["segoeui.ttf", "arial.ttf"], 20)
d = ImageDraw.Draw(bg)

def tracked(draw, xy, text, fnt, fill, extra=2.6):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += fnt.getlength(ch) + extra
    return x - xy[0]

y = title_bottom + 20
w1 = tracked(d, (M, y), ROMAN, f1, OCHRE)
y += 37
d.text((M, y), "The complete Tolkappiyam \u2014 text, commentary and practice",
       font=f2, fill=CREAM)
y += 35

# tricolour rule — accurate for a Government of India institution
for i, col in enumerate([(255, 153, 51), (245, 245, 245), (19, 136, 8)]):
    d.rectangle((M + i * 56, y, M + i * 56 + 54, y + 4), fill=col)
y += 23

# ---- CICT lockup ------------------------------------------------------------
lock = SRC.crop((30, 212, 296, 340))
LW = 186
lock = lock.resize((LW, int(lock.height * (LW / lock.width))), Image.LANCZOS)
bg.paste(lock, (M - 2, y), cutout(lock, 40, 0.5))
lock_bottom = y + lock.height

print("layout: title %d..%d | strapline %d | lockup ..%d | strip starts %d"
      % (TITLE_Y, title_bottom, title_bottom + 20, lock_bottom, H - STRIP))
print("statue box x %d..%d  y %d..%d" % (sx, sx + SW, sy, sy + SH))
assert lock_bottom < H - STRIP + 14, "lockup collides with the manuscript strip"
assert sx > M + 520, "statue overlaps the text column"

out = pathlib.Path(r"D:\Tolkappiyam app\tholkappiyam-android\store\play-feature-graphic-1024x500.png")
bg.convert("RGB").save(out, optimize=True)
print("wrote", out.name, bg.size, bg.mode, "%.0f KB" % (out.stat().st_size / 1024))
