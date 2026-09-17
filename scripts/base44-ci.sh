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
