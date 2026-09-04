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

# ---- Step 4: Initialize or update TWA project ----
echo ""
if [ -f "./twa-manifest.json" ]; then
  echo "▶ twa-manifest.json found — preserving existing config (packageId: com.nalichat)"
  echo "  Skipping 'bubblewrap init' to avoid overwriting the package ID."
  echo "  Running 'bubblewrap update' to pull any web manifest changes..."
  bubblewrap update --skip-gradle-build --manifest https://nalichat.org/manifest.json || echo "⚠️  Update skipped (first run or no changes needed)"
else
  echo "▶ No twa-manifest.json found. Initializing new TWA project..."
  bubblewrap init --manifest https://nalichat.org/manifest.json
  echo ""
  echo "⚠️  IMPORTANT: Verify packageId in twa-manifest.json is 'com.nalichat' before building!"
  echo "   The init command may generate a different package ID based on the domain."
  echo "   Edit twa-manifest.json and set: \"packageId\": \"com.nalichat\""
  exit 1
fi

# ---- Step 5: Build the AAB ----
echo ""
echo "▶ Building Android App Bundle (.aab)..."
bubblewrap build

# ---- Step 6: Done ----
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