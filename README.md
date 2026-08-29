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

## Releasing a new version

1. Replace `app/src/main/assets/www/index.html` with the new portal build.
2. Bump `versionCode` (must strictly increase) and `versionName` in `app/build.gradle`.
3. Commit and push — the workflow rebuilds and re-signs automatically.

## Building locally (optional)

Needs JDK 17 and an Android SDK with platform 35.

```
export KEYSTORE_PATH=/path/to/release.keystore
export STORE_PASSWORD=... KEY_ALIAS=cict KEY_PASSWORD=...
gradle assembleRelease bundleRelease
```

Release tasks abort with a clear message if signing is not configured, so an unsigned
artifact can never be mistaken for a shippable one.
