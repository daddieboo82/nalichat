# Google Play publishing setup

This enables the `android-aab` Codemagic workflow to automatically upload
each build's AAB to your Google Play Console account. **Until you add the
one secret below, nothing changes** — the workflow keeps building and
publishing the AAB/APK to GitHub Releases exactly as it does today, and the
new publishing stage simply has nothing to authenticate with.

Never paste the service account key into a chat, issue, or commit. It goes
into **Codemagic → Team settings → Environment variable groups** (or any
existing group, such as the `keystore_credentials` group already used by
this workflow), marked **Secure**, where Codemagic encrypts it and no one —
including an AI assistant — can read it back out.

## Critical first step: Play Console requires a manual first release

**If this app has never been published to Google Play before, none of this
automation can do that first upload for you.** Google's API does not allow
publishing a brand new app's first release — you must create the app
listing (package name, store listing text, content rating, etc.) and upload
that very first `.aab` manually through the Play Console web UI yourself.

Once that first listing exists, everything below automates every release
after it.

The signed AAB is already sitting at:
`NaliChat-signed.aab` (built and jarsigner-verified earlier in this session)
— if you haven't done that first manual upload yet, that's the file to use
for it, via **Play Console → your app → Release → Production/Testing →
Create new release → upload**.

## Setting up the service account (Google's own steps)

1. In the [Google Cloud Console](https://console.cloud.google.com/), go to
   **IAM & Admin → Service Accounts → Create Service Account**.
2. Give it a name you'll recognize later (e.g. "codemagic-play-publisher"),
   assign it the **Service Account User** role, and finish creation.
3. Open the new service account, copy its **email address** — you'll need
   it in the next section.
4. Go to **Keys → Add Key → Create new key**, choose **JSON**, and download
   it. This file is the actual secret; keep it somewhere safe and never
   commit it.

## Granting it access in Play Console

1. In [Play Console](https://play.google.com/console/), go to **Users and
   permissions → Invite new users**.
2. Paste the service account's email address from above.
3. Under **App permissions**, select this app and grant it the **Releases**
   permission (you do not need Admin access — Releases is enough for
   uploading builds).
4. Click **Invite user** to finish.

## Adding the secret to Codemagic

1. Open the downloaded JSON key file and copy its entire contents.
2. In Codemagic, go to **Team settings → Environment variable groups**.
3. Either open the existing `keystore_credentials` group or create a new
   one, and add a variable named exactly `GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS`,
   paste the JSON content as its value, and mark it **Secure**.
4. If you used a new group name instead of `keystore_credentials`, add that
   group name to the `environment.groups` list in `codemagic.yaml` under the
   `android-aab` workflow (one line) — otherwise no code changes are needed;
   `codemagic.yaml` already references the variable by name.

## What happens on the next build

`codemagic.yaml` already contains:

```yaml
publishing:
  google_play:
    credentials: $GOOGLE_PLAY_SERVICE_ACCOUNT_CREDENTIALS
    track: internal
    submit_as_draft: true
```

- `track: internal` — uploads only to the Internal Testing track, never
  production, so no real user sees it automatically.
- `submit_as_draft: true` — even on that internal track, it lands as a
  draft release you review and roll out yourself from the Play Console.

Once you're happy with a build on Internal Testing, promoting it to a wider
track (Closed/Open Testing, Production) is a manual action you take in Play
Console — this pipeline deliberately does not do that for you.

## Verifying it worked

After a push that touches the AAB build, check the "publishing" section of
that Codemagic build's log for the Google Play upload result. In Play
Console, check **Testing → Internal testing → Releases** for the new build
to appear as a draft.
