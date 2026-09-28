# Base44 Dev Environment

## What this app is
A Vite + React 18 single-page app (`base44-app` / NaliChat) that uses the
`@base44/vite-plugin` and `@base44/sdk` to talk to the **Base44 cloud backend**
(`https://base44.app`). There is no local backend service — the app is
frontend-only and connects to the hosted Base44 server at runtime.

## Running it
- `docker compose -f docker-compose.base44.yml up -d` brings up the Vite dev
  server on host port 3000 (container port 5173).
- The container runs `npm install` then `npx vite --host 0.0.0.0 --port 5173`.
- `node_modules` lives in a named volume (`web_node_modules`) so the bind mount
  doesn't shadow the container's native install.

## Environment variables
All `VITE_*` vars have built-in code defaults (see `src/lib/app-params.js`), so
the app boots with **no secrets**:
- `VITE_BASE44_APP_ID` → defaults to a hardcoded app id
- `VITE_BASE44_BACKEND_URL` → defaults to `https://base44.app`
- `VITE_BASE44_APP_BASE_URL` → defaults to the current origin
- `VITE_PAYWALL_ENABLED` → defaults to `true`; set `false` to hide checkout UI
- `VITE_PAYWALL_VARIANT` → defaults to `auto`

No external credentials are required to start the preview.

## Vite host allowlist
Vite 6.1+ gates dev assets/HMR by origin. The compose file forwards
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` (set by the platform) into the
container so the preview hostname is allowed.

## Useful commands
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Unit tests: `npm test`
- Build: `npm run build`
