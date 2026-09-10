# macOS code signing & notarization setup

This enables the desktop-builds.yml GitHub Actions workflow to produce a
`.dmg` that macOS Gatekeeper accepts without a warning. **Until you add the
secrets below, nothing changes** — the workflow keeps building an unsigned
DMG exactly as it does today, so there is no risk in leaving this undone.

Never paste any of the values below into a chat, issue, or commit. They all
go into **GitHub → this repo → Settings → Secrets and variables → Actions →
New repository secret**, where GitHub encrypts them and no one (including an
AI assistant) can read them back out.

## What you need

You said you already have a paid Apple Developer Program account, so you
have everything required except the actual certificate export.

### 1. A Developer ID Application certificate

This is the certificate Apple issues for distributing apps *outside* the Mac
App Store (which is exactly what a downloadable DMG is).

1. Sign in at [developer.apple.com/account/resources/certificates](https://developer.apple.com/account/resources/certificates/list).
2. Create a new certificate of type **Developer ID Application** (you'll need
   a Certificate Signing Request generated from Keychain Access on a Mac —
   Apple's certificate page walks you through this).
3. Download the resulting `.cer`, double-click it to import into Keychain
   Access, then in Keychain Access find it under **My Certificates**, right
   click it, and choose **Export...** as a **.p12** file. Set a password when
   prompted — you'll need it below.
4. Convert that `.p12` to base64 so it can be stored as a single-line GitHub
   secret:
   ```sh
   base64 -i YourCertificate.p12 | pbcopy
   ```
5. Add two GitHub secrets:
   - `MAC_CERTIFICATE_P12_BASE64` — paste the base64 output from step 4
   - `MAC_CERTIFICATE_PASSWORD` — the password you set in step 3

With just these two, the DMG will be **signed**. Signed alone already
removes some Gatekeeper friction, but macOS will still show a warning on
first launch unless the app is also **notarized** (next section).

### 2. Notarization credentials

Notarization is Apple's automated scan that must pass before Gatekeeper
allows a downloaded app to run with zero warnings.

1. Find your **Team ID**: [developer.apple.com/account](https://developer.apple.com/account) →
   Membership details → Team ID (a 10-character code like `A1B2C3D4E5`).
2. Generate an **app-specific password** for notarization (this is not your
   normal Apple ID password): go to [appleid.apple.com](https://appleid.apple.com/) →
   Sign-In and Security → App-Specific Passwords → generate one, label it
   something like "NaliChat CI notarization".
3. Add three more GitHub secrets:
   - `APPLE_ID` — the Apple ID email tied to your Developer account
   - `APPLE_APP_SPECIFIC_PASSWORD` — the password from step 2
   - `APPLE_TEAM_ID` — the Team ID from step 1

With all five secrets set, the next push that touches `electron/**` will
produce a DMG that's both **signed and notarized** — no Gatekeeper warning,
no right-click-to-open workaround needed.

## How the workflow decides what to do

`.github/workflows/desktop-builds.yml` checks these secrets at build time:

- No `MAC_CERTIFICATE_P12_BASE64` → builds unsigned, same as before.
- `MAC_CERTIFICATE_P12_BASE64` + `MAC_CERTIFICATE_PASSWORD` set, but the
  three Apple ID secrets missing → builds **signed but not notarized**
  (better than unsigned, but Gatekeeper still warns).
- All five secrets set → builds **signed and notarized**.

electron-builder does the signing and notarization itself (via
`@electron/notarize`, bundled with electron-builder 23+) purely from those
environment variables — nothing in this repo needs to change again once the
secrets exist.

## Verifying it worked

After a run with all five secrets set, check the "Build macOS DMG" step's
log in GitHub Actions for a line mentioning notarization succeeding. You can
also verify locally on a Mac after downloading the DMG:

```sh
spctl -a -vv /Applications/NaliChat.app
# should print: accepted, source=Notarized Developer ID
```
