#!/usr/bin/env python3
"""Generate all Android launcher icons from the CICT artwork.

    python tools/make-icons.py <source.png>

Pass store/icon-source-512.png — the launcher composition, not the original
promotional artwork.

Android 8+ masks every icon to the central 66.7% of the canvas. Feeding it the
original graphic sliced the Tamil title in half and clipped the CICT emblem
(store/candidates/preview-A-fullbleed.png shows it). So the launcher icon is
composed from the statue alone, centred inside the safe area on the artwork's own
black ground: nothing is clipped by any mask shape, and the figure stays
recognisable at 48dp. The app name is not baked in because the launcher already
prints it as a label beneath the icon.

store/artwork-original-512.png keeps the full promotional graphic for the Play
listing and marketing, where it is not crop-masked the same way.
"""
import pathlib
import sys

from PIL import Image, ImageDraw

REPO = pathlib.Path(__file__).resolve().parent.parent
RES = REPO / "app/src/main/res"

# density -> (legacy launcher px @48dp, adaptive layer px @108dp)
DENSITIES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}
SAFE_FRACTION = 72 / 108  # adaptive icon guaranteed-visible area


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: make-icons.py <source.png>")
    src_path = pathlib.Path(sys.argv[1])
    src = Image.open(src_path).convert("RGBA")
    if src.width != src.height:
        raise SystemExit(f"source must be square, got {src.size}")

    for density, (legacy_px, adaptive_px) in DENSITIES.items():
        out = RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)

        legacy = src.resize((legacy_px, legacy_px), Image.LANCZOS)
        legacy.convert("RGB").save(out / "ic_launcher.png", optimize=True)
        legacy.convert("RGB").save(out / "ic_launcher_round.png", optimize=True)

        # Full-bleed foreground: the mask does the cropping, not us.
        fg = src.resize((adaptive_px, adaptive_px), Image.LANCZOS)
        fg.save(out / "ic_launcher_foreground.png", optimize=True)

    # Play Console listing icon: 512x512, complete artwork, no transparency.
    store = REPO / "store"
    store.mkdir(exist_ok=True)
    src.convert("RGB").resize((512, 512), Image.LANCZOS).save(
        store / "play-store-icon-512.png", optimize=True
    )

    _previews(src, store)
    print("icons written to", RES)
    print("store assets + mask previews written to", store)


def _previews(src: Image.Image, store: pathlib.Path) -> None:
    """Render what the launcher will actually show, so the crop is reviewable."""
    size = 288
    art = src.resize((size, size), Image.LANCZOS)

    inset = int(size * (1 - SAFE_FRACTION) / 2)
    visible = (inset, inset, size - inset, size - inset)

    # circle mask (Pixel / stock Android)
    circle = Image.new("L", (size, size), 0)
    ImageDraw.Draw(circle).ellipse(visible, fill=255)
    out = Image.new("RGB", (size, size), "white")
    out.paste(art, (0, 0), circle)
    out.save(store / "preview-icon-circle.png")

    # squircle / rounded-square mask (Samsung, OnePlus, most OEMs)
    rounded = Image.new("L", (size, size), 0)
    ImageDraw.Draw(rounded).rounded_rectangle(visible, radius=int(size * 0.16), fill=255)
    out = Image.new("RGB", (size, size), "white")
    out.paste(art, (0, 0), rounded)
    out.save(store / "preview-icon-squircle.png")

    # how it actually reads on a home screen: 48dp, both masks, side by side
    strip = Image.new("RGB", (300, 96), "#efefef")
    for i, mask in enumerate((circle, rounded)):
        tile = Image.new("RGB", (size, size), "#efefef")
        tile.paste(art, (0, 0), mask)
        strip.paste(tile.resize((48, 48), Image.LANCZOS), (60 + i * 130, 24))
    strip.save(store / "preview-icon-actual-size-48dp.png")


if __name__ == "__main__":
    main()
