# NaliChat Studio functionality certification

Updated: 2026-11-17. Development audit, **not** production certification.

## Verification results

| Area | Status | Evidence / next action |
|---|---|---|
| Entire repository automated regression suite | PASS | `npm test -- --reporter=dot`: 2,023 tests, 863 files |
| Repository lint, typecheck, bundle build | PASS | `npm run lint`, `npm run typecheck`, `npm run build` |
| Studio track-strip waveform integrity | PASS (unit) | Waveform peaks derived from track data, zero/silent shows no fabricated peaks |
| Signed-out Studio route on desktop Chromium | PASS (browser) | Redirect to /login with returnTo=/studio, login form renders |
| Signed-out Studio route on mobile Chromium | PASS (browser) | Same |
| Signed-out Studio route on iPhone-sized WebKit simulation | PASS (browser) | Same; this is not testing a physical iPhone |
| Authenticated Studio desktop/mobile visual layout | NOT VERIFIED | No E2E_USER_EMAIL or E2E_USER_PASSWORD available in sandbox |
| Actual microphone capture and audible playback | NOT VERIFIED | Requires signed-in browser, microphone fixture and playback/content check |
| MIDI controller note events, sustain, hot-plug and unplug | NOT VERIFIED | Requires signed-in browser and test MIDI device(s); source/unit tests alone are insufficient |
| Track cut, split, dragging, Undo/Redo, automation and mixer | NOT VERIFIED END-TO-END | Execute Playwright workflows in authenticated Studio; inspect resulting clip state and rendered audio |
| Cloud project save, reload, and reopening an audio take | NOT VERIFIED | Requires signed-in account and project persistence verification |
| WAV/ZIP export and replay of decoded exported audio | NOT VERIFIED | Requires signed-in playback/export workflow and downloaded file validation |
| Physical device / mobile browser audio | NOT VERIFIED | Test actual target devices after authenticated browser checks |

## Repeatable local commands

```bash
npm run lint
npm run typecheck
npm test -- --reporter=dot
npm run build
npx playwright install chromium webkit
npx playwright install-deps chromium webkit
npx playwright test e2e/studio-auth-gate.spec.js
```

Playwright's existing authenticated Studio tests under `e2e/studio-*.spec.js` skip when
`E2E_USER_EMAIL` and `E2E_USER_PASSWORD` are absent. Use dedicated test credentials
via environment variables, not source code, to run them. Never publish production merely
because these non-authenticated checks pass.

The old `/studio-capture` probe route returns a 404 in this app. The current Studio route is `/studio`.

## Release gate

Do **not** call Studio 100% functional or production-certified until authenticated end-to-end
flows, actual audio output, persistent reopen, exported file verification and hardware/device
compatibility have passed. Log concrete run links, screenshots, failures and retests here.
