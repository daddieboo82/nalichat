#!/usr/bin/env bash
set -euo pipefail

echo "==> Installing dependencies"
npm ci

echo "==> Running release verification"
npm run verify:release

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
  echo "==> Authenticated E2E skipped: runner variables are not available"
  printf '    missing: %s\n' "${missing[@]}"
  exit 0
fi

echo "==> Running authenticated production E2E"
E2E_BASE_URL="${E2E_BASE_URL:-https://nalichat.org}" \
  npx playwright test e2e/authenticated-smoke.spec.js \
  --project=mobile-chromium \
  --project=iphone-16-simulation

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
