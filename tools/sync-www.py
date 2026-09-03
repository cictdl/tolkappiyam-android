#!/usr/bin/env python3
"""Refresh the bundled portal from the web edition, re-applying the app chrome.

The APK ships a copy of the portal, not the original: it additionally loads
android.css and android.js, which rebuild the masthead for a phone and move the
search box out of the drawer. Copying a new index.html over the top by hand
silently drops those two tags and the old 529px masthead comes back. This script
does the copy and the injection together so that cannot happen.

    python tools/sync-www.py [path-to-portal-index.html]
"""
import pathlib
import re
import shutil
import sys

REPO = pathlib.Path(__file__).resolve().parent.parent
DEST = REPO / "app/src/main/assets/www"
DEFAULT_SRC = pathlib.Path(r"D:\Tolkappiyam app\tolkappiyam\tholkappiyam-pwa")


def _app_version() -> str:
    """versionCode from app/build.gradle, used to bust caches on every release."""
    gradle = (REPO / "app/build.gradle").read_text(encoding="utf-8")
    m = re.search(r"versionCode\s+(\d+)", gradle)
    return m.group(1) if m else "0"


def _tags(version: str) -> str:
    """The two app-only chrome tags, cache-busted by app version.

    The WebView's HTTP cache survives an app update, so an unversioned
    android.js would let a freshly installed APK keep running the previous
    build's chrome. Pinning the query to versionCode forces a fresh fetch on
    every release. This was not theoretical: it bit during development, where a
    cached android.js silently ignored a fix that was already on disk.
    """
    return (
        '<link rel="stylesheet" href="android.css?v=' + version + '">\n'
        '<script src="android.js?v=' + version + '" defer></script>\n'
    )


def inject(html: str, version: str) -> str:
    """Add the app chrome tags as the last thing in <head>, exactly once."""
    html = re.sub(r'\s*<link rel="stylesheet" href="android\.css(\?v=\d+)?">', "", html)
    html = re.sub(r'\s*<script src="android\.js(\?v=\d+)?" defer></script>', "", html)
    if "</head>" not in html:
        raise SystemExit("no </head> in source html — refusing to guess")
    return html.replace("</head>", _tags(version) + "</head>", 1)


def main() -> None:
    src_arg = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    src_dir = src_arg.parent if src_arg.is_file() else src_arg
    src_html = src_arg if src_arg.is_file() else src_dir / "index.html"
    if not src_html.exists():
        raise SystemExit(f"source portal not found: {src_html}")

    version = _app_version()
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "index.html").write_text(
        inject(src_html.read_text(encoding="utf-8"), version), encoding="utf-8"
    )

    for name in ("manifest.webmanifest", "sw.js"):
        if (src_dir / name).exists():
            shutil.copy2(src_dir / name, DEST / name)
    if (src_dir / "icons").is_dir():
        shutil.copytree(src_dir / "icons", DEST / "icons", dirs_exist_ok=True)

    kb = (DEST / "index.html").stat().st_size / 1024
    print(f"synced {src_html} -> {DEST/'index.html'} ({kb:.0f} KB, chrome tags v={version})")
    print("android.css / android.js are app-only and are never overwritten by this script.")


if __name__ == "__main__":
    main()
