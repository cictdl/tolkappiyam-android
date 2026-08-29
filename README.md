# தொல்காப்பியம் · Tolkappiyam — Android

Native Android wrapper around the offline Tolkappiyam portal (CICT Digital Archives).
GitHub Actions produces a **signed APK and a signed AAB** on every push to `main`
and on demand from the Actions tab. Nothing needs to be installed locally.

- **Package id** `com.cict.tolkappiyam` — permanent once published on Google Play
- **Version** 1.0 (versionCode 1) — bump both in `app/build.gradle` for each release
- **minSdk 24** (Android 7.0) · **targetSdk 35** (Android 15)

## How it works

`app/src/main/assets/www/` holds the entire portal: one self-contained `index.html`
plus the PWA manifest, service worker and icons. `MainActivity` serves that folder
over the virtual origin `https://appassets.androidplatform.net/` using
`WebViewAssetLoader`, rather than over `file://`. That matters: the portal registers
a service worker and stores reading position, bookmarks and game scores in
`localStorage`, and neither is available to a `file://` document.

Internal links stay in the WebView. Outbound links — the share buttons, the Digital
Archives site, the Sangam corpus index — open in the device browser. The bundled
corpus itself needs no network; only the Google webfonts and those outbound links do,
and Android ships Noto Sans/Serif Tamil so the typography holds up offline.

## One-time setup

### 1. Push this folder to a GitHub repository

```
cd tholkappiyam-android
git remote add origin https://github.com/<org>/tolkappiyam-android.git
git push -u origin main
```

### 2. Add four repository secrets

Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Value |
|---|---|
| `KEYSTORE_BASE64` | the whole contents of `keystore/keystore.b64.txt` |
| `STORE_PASSWORD`  | from `keystore/KEYSTORE-SECRETS.txt` |
| `KEY_ALIAS`       | `cict` |
| `KEY_PASSWORD`    | same as `STORE_PASSWORD` |

The `keystore/` folder is **not** part of this repository and is git-ignored. Back it
up offline. If the keystore or its password is lost, Play will never accept another
update to `com.cict.tolkappiyam`.

### 3. Run the build

Actions tab → **Build Android (APK + AAB)** → **Run workflow**. About 4 minutes.
Download from the finished run:

- `tolkappiyam-apk` → `app-release.apk` — sideload onto a phone
- `tolkappiyam-aab` → `app-release.aab` — upload to the Play Console

The workflow runs `apksigner verify --print-certs` before uploading, so a build that
succeeds has demonstrably produced a signed APK.

## App-only chrome

The APK ships a *modified* copy of the portal: `index.html` additionally loads
`android.css` and `android.js`. The web edition is untouched.

The web masthead is 529px tall on a 375px phone and the hero adds 427px more, so 70%
of the first screen was chrome before a line of Tolkappiyam appeared. In a standalone
app most of that is redundant — the launcher icon and app name already say whose app
this is. The two files:

- collapse the masthead into a 52px app bar (menu · logo · title · language);
- **move** — never delete — the Government of India / Ministry of Education strip and
  the full institution identity into the drawer, where they stay one tap away;
- put the corpus counts on one scrollable row on the landing view;
- retire the hero quote once the reader navigates, so pages start at the content;
- follow the device dark mode, using the dark palette the portal already defines but
  never activates;
- disable the service worker (see below).

Result: content starts at 7% of the screen when reading, down from 70%.

### Why the service worker is disabled in the app

`sw.js` is cache-first over `tk-portal-v1`. On the web that is what makes the portal
work offline. Inside the APK every asset is already local, so it buys nothing — and its
cache lives in the WebView data directory, which **survives an app update**. Ship a new
portal in a new APK and the stale cache keeps serving the old one. This was observed,
not theorised: the first UI rebuild rendered the old masthead until the cache was
cleared. `android.js` unregisters it and blocks re-registration.

### Updating the bundled portal

Do **not** copy `index.html` over by hand — that silently drops the two chrome tags and
the old masthead returns. Use:

```
python tools/sync-www.py [path-to-portal-index.html]
```

It copies the portal and re-injects the tags. `android.css` / `android.js` are app-only
and are never overwritten.

## Releasing a new version

1. Replace `app/src/main/assets/www/index.html` with the new portal build.
2. Bump `versionCode` (must strictly increase) and `versionName` in `app/build.gradle`.
3. Commit and push — the workflow rebuilds and re-signs automatically.

## Building locally

A private toolchain is installed at `D:	k-toolchain` (JDK 21, Gradle 8.10.2, Android
SDK platform 35 + build-tools 35.0.0). It is not on the system PATH and does not touch
any existing Java install. One command does everything:

```
./build-release.sh
```

That builds, verifies both signatures, and stages the artifacts into
`D:\Tolkappiyam app
elease\` with a `SHA256SUMS.txt`.

`local.properties` (git-ignored) points Gradle at the SDK. Note it must use **forward
slashes** — `.properties` files treat backslash as an escape, so `D:	k-toolchain`
silently becomes `D:<TAB>k-toolchain`.

Release tasks abort with a clear message if signing is not configured, so an unsigned
artifact can never be mistaken for a shippable one.
