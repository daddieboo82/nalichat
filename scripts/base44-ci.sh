#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies"
npm ci

echo "==> Checking local checkout reservation concurrency model (SQLite only)"
python3 scripts/test-checkout-sqlite-model.py

echo "==> Checking local PayPal webhook atomic-claim concurrency model (SQLite only)"
python3 scripts/test-paypal-webhook-ledger-sqlite-model.py

echo "==> Demonstrating read-then-create PayPal webhook race vs atomic unique claim"
python3 scripts/test-paypal-webhook-race-demonstration.py

echo "==> Running release verification"
npm run verify:release

echo "==> Enforcing PayPal webhook atomicity release gate"
node scripts/verify-paypal-webhook-atomicity.mjs

echo "==> Installing Playwright runners"
npx playwright install --with-deps chromium webkit

echo "==> Running public browser smoke tests"
npx playwright test e2e/smoke.spec.js

required_vars=(
  E2E_USER_EMAIL
  E2E_USER_PASSWORD
  E2E_SECOND_USER_EMAIL
  E2E_SECOND_USER_PASSWORD
)

missing=()
for name in "${required_vars[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (( ${#missing[@]} > 0 )); then
  echo "ERROR: Authenticated production E2E cannot run; required runner variables are missing."
  printf '    missing: %s\n' "${missing[@]}"
  echo "Configure these in the Base44 CI runner's protected environment, then rerun."
  exit 1
fi

echo "==> Running authenticated production E2E (desktop, Android-sized mobile, iPhone-sized mobile)"
E2E_BASE_URL="${E2E_BASE_URL:-https://nalichat.org}" \
  npx playwright test e2e/authenticated-smoke.spec.js \
  --project=chromium \
  --project=mobile-chromium \
  --project=iphone-16-simulation

echo "==> Running authenticated Studio visual and clip-drag E2E"
E2E_BASE_URL="${E2E_BASE_URL:-https://nalichat.org}" \
  npx playwright test e2e/studio-track-drag.spec.js e2e/studio-visual-integrity.spec.js \
  --project=chromium \
  --project=mobile-chromium

echo "==> Creating protected fake microphone fixture"
python3 - << 'PY'
import math
import wave
path = '/tmp/nalichat-e2e-audio.wav'
sample_rate = 48000
duration = 3
with wave.open(path, 'wb') as wav:
    wav.setnchannels(1)
    wav.setsampwidth(2)
    wav.setframerate(sample_rate)
    for i in range(sample_rate * duration):
        sample = int(12000 * math.sin(2 * math.pi * 440 * i / sample_rate))
        wav.writeframesraw(sample.to_bytes(2, 'little', signed=True))
PY
test -s /tmp/nalichat-e2e-audio.wav

echo "==> Running authenticated production live-session recording E2E"
E2E_BASE_URL="${E2E_BASE_URL:-https://nalichat.org}" \
E2E_FAKE_MEDIA=1 \
E2E_FAKE_AUDIO_FILE=/tmp/nalichat-e2e-audio.wav \
  npx playwright test e2e/live-session-recording.spec.js \
  --project=mobile-chromium \
  --project=iphone-16-simulation
