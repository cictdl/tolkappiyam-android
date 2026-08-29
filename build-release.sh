#!/usr/bin/env bash
# Build and verify the signed release APK + AAB on this machine.
# The toolchain lives at D:\tk-toolchain and is deliberately not on the system PATH.
set -euo pipefail
cd "$(dirname "$0")"

TOOLCHAIN=/d/tk-toolchain
KEYSTORE_DIR="/d/Tolkappiyam app/keystore"

export JAVA_HOME='D:\tk-toolchain\jdk21'
export ANDROID_HOME='D:\tk-toolchain\android-sdk'
export KEYSTORE_PATH="$(cygpath -w "$KEYSTORE_DIR/release.keystore")"
export STORE_PASSWORD="$(grep -oP 'STORE_PASSWORD\s+\K\S+' "$KEYSTORE_DIR/KEYSTORE-SECRETS.txt")"
export KEY_ALIAS=cict
export KEY_PASSWORD="$STORE_PASSWORD"

"$TOOLCHAIN/gradle/bin/gradle" clean assembleRelease bundleRelease --console=plain

APK=app/build/outputs/apk/release/app-release.apk
AAB=app/build/outputs/bundle/release/app-release.aab

# A build is only done when the signature is proven, not merely when gradle exits 0.
"$TOOLCHAIN/android-sdk/build-tools/35.0.0/apksigner.bat" verify --verbose --print-certs "$APK"
"$TOOLCHAIN/jdk21/bin/jarsigner" -verify "$AAB"

VER=$(grep -oP 'versionName\s+"\K[^"]+' app/build.gradle)
OUT="/d/Tolkappiyam app/release"
mkdir -p "$OUT"
cp "$APK" "$OUT/tolkappiyam-$VER-release.apk"
cp "$AAB" "$OUT/tolkappiyam-$VER-release.aab"
( cd "$OUT" && sha256sum "tolkappiyam-$VER-release.apk" "tolkappiyam-$VER-release.aab" > SHA256SUMS.txt )
echo
echo "Staged in $OUT:"
ls -lh "$OUT"
