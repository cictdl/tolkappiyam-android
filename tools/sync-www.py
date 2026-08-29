#!/usr/bin/env python3
"""Refresh the bundled portal from the web edition, re-applying the app chrome.

The APK ships a copy of the portal, not the original: it additionally loads
android.css and android.js, which move the government masthead into the drawer.
Copying a new index.html over the top by hand silently drops those two tags and
the old 529px masthead comes back. This script does the copy and the injection
together so that cannot happen.

    python tools/sync-www.py [path-to-portal-index.html]
"""
import pathlib
import re
import shutil
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
DEST = REPO / "app/src/main/assets/www"
DEFAULT_SRC = pathlib.Path(r"D:\Tolkappiyam app\tolkappiyam\tholkappiyam-pwa")

TAGS = (
    '<link rel="stylesheet" href="android.css">\n'
    '<script src="android.js" defer></script>\n'
)


def inject(html: str) -> str:
    """Add the app chrome tags as the last thing in <head>, exactly once."""
    html = re.sub(r'\s*<link rel="stylesheet" href="android\.css">', "", html)
    html = re.sub(r'\s*<script src="android\.js" defer></script>', "", html)
    if "</head>" not in html:
        raise SystemExit("no </head> in source html — refusing to guess")
    return html.replace("</head>", TAGS + "</head>", 1)


def main() -> None:
    src_arg = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    src_dir = src_arg.parent if src_arg.is_file() else src_arg
    src_html = src_arg if src_arg.is_file() else src_dir / "index.html"
    if not src_html.exists():
        raise SystemExit(f"source portal not found: {src_html}")

    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "index.html").write_text(
        inject(src_html.read_text(encoding="utf-8")), encoding="utf-8"
    )

    for name in ("manifest.webmanifest", "sw.js"):
        if (src_dir / name).exists():
            shutil.copy2(src_dir / name, DEST / name)
    if (src_dir / "icons").is_dir():
        shutil.copytree(src_dir / "icons", DEST / "icons", dirs_exist_ok=True)

    kb = (DEST / "index.html").stat().st_size / 1024
    print(f"synced {src_html} -> {DEST/'index.html'} ({kb:.0f} KB, chrome tags injected)")
    print("android.css / android.js are app-only and are never overwritten by this script.")


if __name__ == "__main__":
    main()
