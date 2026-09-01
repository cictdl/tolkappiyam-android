# Store & icon assets

- `artwork-original-512.png` — the CICT promotional graphic as supplied. Use for the
  Play listing and marketing. **Not** usable as a launcher icon: see below.
- `icon-source-512.png` — the launcher composition actually shipped (statue, centred,
  on the artwork's black ground). `tools/make-icons.py` generates every density from it.
- `play-store-icon-512.png` — generated from the launcher composition.
- `preview-icon-circle.png`, `preview-icon-squircle.png`,
  `preview-icon-actual-size-48dp.png` — what the launcher actually renders.
- `candidates/` — the options considered, with masked previews:
  - `preview-A-fullbleed.png` — original artwork used directly. The circle mask cuts
    the Tamil title in half and clips the emblem. Rejected.
  - `preview-B-whole-artwork.png` — whole artwork shrunk to fit inside the mask.
    Nothing clipped, but the figure is tiny and the text is still illegible at 48dp.
  - `preview-C-statue.png` — shipped.

## Why the app name is not in the icon

Android 8+ masks every launcher icon to the central 66.7% of its canvas, and at 48dp
Tamil text is unreadable in any case. The launcher already prints
"தொல்காப்பிய நுண்ணறிவு" as a label directly beneath the icon, so putting the name
inside the artwork is redundant and costs the space the figure needs to be recognisable.
