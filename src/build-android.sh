#!/bin/bash

# NaliChat - Android AAB Build Script
# Run this script to generate a signed Android App Bundle for Google Play Store

set -e

echo "========================================="
echo "  NaliChat Android Build Script"
echo "========================================="

# ---- Step 1: Check dependencies ----
echo ""
echo "▶ Checking dependencies..."

if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Install from https://nodejs.org"
  exit 1
fi

if ! command -v java &> /dev/null; then
  echo "❌ Java not found. Install JDK 17 from https://adoptium.net"
  exit 1
fi

echo "✅ Node.js: $(node -v)"
echo "✅ Java: $(java -version 2>&1 | head -1)"

# ---- Step 2: Install Bubblewrap ----
echo ""
echo "▶ Installing Bubblewrap CLI..."
npm install -g @bubblewrap/cli

# ---- Step 3: Generate keystore if it doesn't exist ----
if [ ! -f "./android.keystore" ]; then
  echo ""
  echo "▶ No keystore found. Generating a new one..."
  echo "⚠️  IMPORTANT: Save the keystore file and passwords somewhere safe!"
  echo "   You will need the SAME keystore for every future app update."
  echo ""
  keytool -genkey -v \
    -keystore ./android.keystore \
    -alias nalichat \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=NaliChat, OU=Mobile, O=NaliChat, L=Indianapolis, S=Indiana, C=US"
  echo "✅ Keystore created at ./android.keystore"
else
  echo "✅ Using existing keystore: ./android.keystore"
fi

# ---- Step 4: Ensure twa-manifest.json has correct packageId ----
echo ""
if [ ! -f "./twa-manifest.json" ]; then
  echo "▶ No twa-manifest.json found. Initializing new TWA project..."
  bubblewrap init --manifest https://nalichat.org/manifest.json
  echo ""
  echo "⚠️  IMPORTANT: Set packageId in twa-manifest.json to 'com.nalichat' before building!"
  echo "   Then re-run this script."
  exit 1
fi

echo "▶ twa-manifest.json found"

# Cross-platform sed in-place edit (macOS needs -i '', Linux needs -i)
sed_inplace() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

# Fix twa-manifest.json packageId FIRST — bubblewrap update reads this to generate build.gradle
MANIFEST_ID=$(grep -o '"packageId"[[:space:]]*:[[:space:]]*"[^"]*"' ./twa-manifest.json | head -1 | sed 's/.*: *//;s/"//g')
if [ "$MANIFEST_ID" != "com.nalichat" ]; then
  echo "  ⚠️  twa-manifest.json packageId is '$MANIFEST_ID' — fixing to 'com.nalichat'"
  sed_inplace "s/\"packageId\"[[:space:]]*:[[:space:]]*\"[^\"]*\"/\"packageId\": \"com.nalichat\"/g" ./twa-manifest.json
  echo "  ✅ twa-manifest.json packageId set to com.nalichat"
else
  echo "  ✅ twa-manifest.json packageId already correct: com.nalichat"
fi

# ---- Step 5: Delete stale build.gradle and regenerate from corrected twa-manifest.json ----
echo ""
echo "▶ Regenerating Gradle project from twa-manifest.json (packageId: com.nalichat)..."

# Delete stale gradle files that may have the wrong applicationId from a previous init
if [ -f "./app/build.gradle" ]; then
  OLD_ID=$(grep -E "^\s*applicationId" "./app/build.gradle" | head -1 | sed "s/.*['\"]//;s/['\"].*//")
  if [ "$OLD_ID" != "com.nalichat" ]; then
    echo "  Stale build.gradle has applicationId '$OLD_ID' — deleting to force regeneration"
    rm -f ./app/build.gradle
  fi
fi
if [ -f "./app/build.gradle.kts" ]; then
  OLD_ID=$(grep -E "^\s*applicationId" "./app/build.gradle.kts" | head -1 | sed "s/.*['\"]//;s/['\"].*//")
  if [ "$OLD_ID" != "com.nalichat" ]; then
    echo "  Stale build.gradle.kts has applicationId '$OLD_ID' — deleting to force regeneration"
    rm -f ./app/build.gradle.kts
  fi
fi

# Run bubblewrap update to regenerate gradle files from twa-manifest.json
echo "  Running 'bubblewrap update'..."
bubblewrap update --skip-gradle-build || echo "⚠️  Update had issues — proceeding anyway"

# ---- Step 6: Verify and enforce applicationId in generated build.gradle ----
echo ""
echo "▶ Verifying applicationId in generated Gradle files..."

fix_gradle_file() {
  local FILE="$1"
  if [ ! -f "$FILE" ]; then return; fi
  local CURRENT_ID
  CURRENT_ID=$(grep -E "^\s*applicationId" "$FILE" | head -1 | sed "s/.*['\"]//;s/['\"].*//")
  echo "  $FILE → applicationId: $CURRENT_ID"
  if [ "$CURRENT_ID" != "com.nalichat" ]; then
    echo "  ⚠️  Fixing to com.nalichat..."
    sed_inplace "s/applicationId [\"'].*[\"']/applicationId \"com.nalichat\"/g" "$FILE"
    sed_inplace "s/namespace [\"'].*[\"']/namespace \"com.nalichat\"/g" "$FILE"
    echo "  ✅ Fixed $FILE"
  else
    echo "  ✅ $FILE already correct"
  fi
}

fix_gradle_file "./app/build.gradle"
fix_gradle_file "./app/build.gradle.kts"

# ---- Step 7: Build the AAB ----
echo ""
echo "▶ Building Android App Bundle (.aab)..."
bubblewrap build

# ---- Step 8: Verify the package name in the built AAB ----
echo ""
echo "▶ Verifying package name in built AAB..."
AAB_FILE="./app-release-bundle.aab"
if [ ! -f "$AAB_FILE" ]; then
  echo "❌ AAB file not found at $AAB_FILE — build may have failed"
  exit 1
fi

# Unzip the AAB and check the manifest for the package name
TMP_DIR=$(mktemp -d)
unzip -o "$AAB_FILE" "base/manifest/AndroidManifest.xml" -d "$TMP_DIR" 2>/dev/null || true
MANIFEST_XML="$TMP_DIR/base/manifest/AndroidManifest.xml"
if [ -f "$MANIFEST_XML" ]; then
  # AndroidManifest.xml in AAB is compiled binary XML — extract package with strings
  AAB_PACKAGE=$(strings "$MANIFEST_XML" | grep -i "com.nalichat" | head -1)
  if echo "$AAB_PACKAGE" | grep -q "com.nalichat"; then
    echo "  ✅ Package name in AAB: com.nalichat"
  else
    echo "  ⚠️  Could not verify com.nalichat in binary manifest."
    echo "  Checking with aapt2 if available..."
    if command -v aapt2 &> /dev/null; then
      aapt2 dump packagename "$AAB_FILE" 2>/dev/null || echo "  (aapt2 dump failed — proceeding)"
    fi
  fi
else
  echo "  ⚠️  Could not extract AndroidManifest.xml from AAB for verification"
fi
rm -rf "$TMP_DIR"

# ---- Step 9: Done ----
echo ""
echo "========================================="
echo "  ✅ Build Complete!"
echo "========================================="
echo ""
echo "Your signed AAB is ready at:"
echo "  ./app-release-bundle.aab"
echo ""
echo "Upload it to Google Play Console:"
echo "  https://play.google.com/console"
echo ""
echo "For the Digital Asset Links verification, add this to:"
echo "  public/.well-known/assetlinks.json"
echo "(Run: bubblewrap fingerprint to get your SHA-256)"