# NaliChat — Google Play Store Setup Guide

Everything you need to publish NaliChat on the Google Play Store, in three parts:
1. **Store listing content** — copy-paste text for the Play Console
2. **Uploading the AAB** — creating the app + uploading the signed bundle
3. **Policy & data safety forms** — content rating, data safety, declarations

---

## 1. Store Listing Content

### App Details
| Field | Value |
|---|---|
| **App name** | NaliChat |
| **Developer name** | (your name or company) |
| **Developer website** | https://nalichat.org |
| **Privacy Policy URL** | https://nalichat.org/privacy |
| **Package ID** | `com.nalichat` |
| **App type** | App |
| **Category** | Music & Audio |

### Short Description (max 80 characters)
```
Collaborate, produce, and share music in real time with AI-powered studio tools.
```

### Full Description (max 4000 characters)
```
NaliChat is the collaborative workspace for music production and industry professionals. Create, collaborate, and share — all in one real-time studio environment.

REAL-TIME COLLABORATION
• Unlimited messaging with voice notes and high-resolution file sharing
• Live Jam Rooms: multiplayer Studio co-editing with live audio and video
• Squad up with collaborators and unlock weekly bonus rewards together

AI-POWERED STUDIO
• AI Stem Engine: instantly separate stems or generate royalty-free background samples
• AI Mastering: automatically master your tracks to industry-standard loudness and clarity
• AI Cover Art: generate stunning album covers for your tracks
• AI Tagging: auto-suggest BPM, genre, and key for every track you upload
• Surgical-precision waveform editing with high-zoom levels and click-to-select workflows

PROJECT MANAGEMENT
• Create projects, organize tracks, and manage collaborators with role-based permissions
• Set milestones, track progress, and keep your team aligned
• Version history for every track with side-by-side comparison

MARKETPLACE & DISCOVERY
• Stems Marketplace: drop your music, discover trending tracks, and buy or sell stem licenses
• Explore page with curated tracks and creator spotlights
• Build and share playlists of your favorite artist collections
• Climb the leaderboard and showcase your talent to the world

GROW YOUR AUDIENCE
• Deep analytics: track plays, reach, audience growth, and listener engagement
• Creator profiles with achievements, level progression, and portfolio showcases
• Remix Challenges: compete in hosted challenges, submit your remixes, and earn community votes
• Viral Seed: AI-native social features to help your music reach new audiences

NALI AI ASSISTANT
• Your omnipresent AI guide for music production and industry insights
• Proactive but non-intrusive — you control visibility and proactivity level
• Warm, natural voice responses powered by text-to-speech

NaliChat is free to use. Monetization is through optional per-item purchases (tracks, stem licenses, studio exports) and community-supported donations. No paywall, no gated core features.

Join the community and start creating today.
```

### Tags (select up to 5)
- Music
- Audio
- Collaboration
- Music production
- Social

### App Icon
- **Size**: 512 × 512 px, 32-bit PNG (with alpha)
- Your existing icon URL: `https://media.base44.com/images/public/6a1f5ee134147461560c2b37/da0cb6e0c_generated_image.png`
- Download this image and resize to 512×512 if needed.

### Feature Graphic
- **Size**: 1024 × 500 px, PNG or JPEG (no alpha)
- This is the banner at the top of your store listing. Create a graphic that shows the NaliChat logo on a dark background (#0f0a14) with the tagline "Collaborate. Produce. Share." Use the neon gradient style (purple → pink → cyan) consistent with your branding.

### Phone Screenshots (required: minimum 2, recommended 8)
- **Size**: 16:9 or 9:16, minimum 320px, maximum 3840px, PNG or JPEG
- Capture these screens from the app (use desktop preview at mobile viewport, then crop):
  1. Home dashboard with feature grid
  2. Studio multi-track editor
  3. Messages / conversation view
  4. Explore marketplace page
  5. Remix Challenges hub
  6. Creator profile with achievements
  7. Analytics dashboard
  8. Leaderboard

> **Tip**: Use the preview tool at mobile viewport to capture clean screenshots. The app's dark theme looks great on the store — make sure screenshots show the neon gradient accents.

### 7-inch Tablet Screenshots (optional but recommended)
- Same content as phone screenshots but captured at tablet viewport.

---

## 2. Uploading the AAB

### Step 1: Create a Google Play Developer Account
1. Go to https://play.google.com/console/signup
2. Sign in with a Google account
3. Pay the one-time **$25 USD registration fee**
4. Complete your developer profile (name, contact email, website)
5. Verify your identity (may take 1–3 days for review)

### Step 2: Create a New App in the Play Console
1. Go to **Play Console** → **All apps** → **Create app**
2. Fill in:
   - **App name**: NaliChat
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free
3. Accept the declarations and click **Create app**

### Step 3: Set Up Your App (Dashboard Tasks)
The Play Console dashboard will show a setup checklist. Complete these before uploading:

1. **App access** → declare if your app has restricted access (NaliChat requires login, so select "Some functionality is restricted" and describe that messaging and studio features require an account)
2. **Ads** → declare whether your app contains ads (No, unless you've added ad SDKs)
3. **Content rating** → complete the questionnaire (see Section 3 below)
4. **Target audience** → select "13 and older" (your Privacy Policy states the app is not directed to children under 13)
5. **News app** → No
6. **Data safety** → complete the data safety form (see Section 3 below)
7. **Government apps** → No
8. **Financial features** → No (donations and marketplace sales are not financial features per Google's definition)
9. **Privacy Policy** → add URL: `https://nalichat.org/privacy`

### Step 4: Upload the Signed AAB

Your Codemagic CI/CD pipeline builds the AAB automatically on every push to `main`. To get the AAB:

**Option A — Download from Codemagic:**
1. Go to your Codemagic dashboard
2. Find the latest successful `NaliChat Android AAB` build
3. Download the `.aab` file from the build artifacts

**Option B — Trigger a new build:**
1. Push any commit to the `main` branch
2. Wait for the Codemagic build to complete (~15–25 minutes)
3. Download the `.aab` from artifacts

**Upload to Play Console:**
1. Go to **Play Console** → **NaliChat** → **Production** → **Create release**
2. Under "App bundles", click **Upload** and select your `.aab` file
3. Wait for the upload to process (Google validates the bundle)
4. **Important**: The package ID in the AAB is `com.nalichat` — this must match the app you created. If you get a package name mismatch error, you may have created the app with a different package ID. The AAB built by Codemagic uses `com.nalichat`.

### Step 5: Release Details
1. **Release name**: `1.0.1` (matches your `appVersionName`)
2. **Release notes** (copy-paste):
```
Welcome to NaliChat! This is our initial release.

• Real-time messaging with voice notes and file sharing
• Multiplayer Studio with live audio/video co-editing
• AI Stem Engine, AI Mastering, AI Cover Art, and AI Tagging
• Project management with milestones and collaborator roles
• Stems Marketplace — buy and sell stem licenses
• Remix Challenges hub with community voting
• Creator profiles, leaderboards, and achievements
• Deep analytics for audience growth and engagement
• Nali AI assistant with natural voice responses
```
3. Click **Save** → **Review release** → **Start rollout to Production**

### Step 6: App Signing
- Google Play App Signing is **opt-in but recommended**. When you upload your first AAB, Google will ask you to opt in.
- Opt in — Google manages the app signing key for you.
- Your Codemagic build uses a self-signed keystore (passwords: `nalichat-store`, alias: `nalichat`) for upload signing. Google's app signing handles the final distribution key separately.

---

## 3. Policy & Data Safety Forms

### Content Rating Questionnaire

Go to **Play Console** → **App content** → **Content rating** → **Start questionnaire**

Answer as follows:

| Question | Answer |
|---|---|
| App category | **Music & Audio** |
| Does your app contain violence? | No |
| Does your app contain sexual content or nudity? | No |
| Does your app contain profanity or crude humor? | No |
| Does your app contain controlled substances or alcohol/tobacco references? | No |
| Does your app contain gambling? | No |
| Does your app contain scary or horror content? | No |
| Does your app contain user-generated content? | **Yes** (users upload music, messages, and posts) |
| Does your app allow users to interact or communicate with each other? | **Yes** (messaging, comments, challenges) |
| Does your app share user-generated content publicly? | **Yes** (Explore marketplace, challenges) |
| Does your app have a mechanism for blocking/reporting users or content? | **Yes** (Report Content dialog on messages and art posts) |

**Expected rating**: Everyone (E) or Teen (T) depending on UGC answers. With user interaction + public UGC, expect **Teen**.

### Data Safety Form

Go to **Play Console** → **App content** → **Data safety** → **Start**

#### Section 1: Data Collection
**Does your app collect or share user data?** → **Yes**

#### Section 2: Data Types Collected

| Data Type | Specific Data | Purpose | Required/Optional |
|---|---|---|---|
| **Personal info** | Email address | Account registration, authentication | Required |
| **Personal info** | Name (display name) | Profile, social features | Required |
| **Personal info** | Profile photo | Profile display | Optional |
| **Photos & videos** | User-uploaded images (cover art, avatars) | App functionality (sharing, profile) | Optional |
| **Audio files** | User-uploaded audio (tracks, voice notes) | App functionality (studio, messaging, marketplace) | Optional |
| **Messages** | User messages and comments | Communication, social features | Optional |
| **App activity** | Page visits, feature usage | Analytics, personalization | Required |
| **App info and performance** | Crash data, performance metrics | App improvement | Required |
| **Device or other IDs** | Device identifiers | Authentication, security | Required |

#### Section 3: Data Usage & Handling

| Question | Answer |
|---|---|
| Is all user data encrypted in transit? | **Yes** (HTTPS/TLS for all connections) |
| Is data collected required, or can users opt out? | Users can opt out of optional data; account data is required for core features |
| Do you provide a way for users to request data deletion? | **Yes** (account deletion available in Settings; Privacy Policy describes the process) |
| Is data shared with third parties? | **Yes** — with other users (per their privacy settings) and service providers (cloud storage, analytics) |

#### Section 4: Security Practices
| Question | Answer |
|---|---|
| Do you encrypt user data in transit? | **Yes** |
| Do you provide a method for users to request deletion of their data? | **Yes** |

### Privacy Policy

Your Privacy Policy is already live at: **https://nalichat.org/privacy**

Add this URL in:
- **Play Console** → **App content** → **Privacy Policy** → enter the URL

### Target Audience

| Question | Answer |
|---|---|
| Target age group | **13–18** and **18+** (select "13 and older") |
| Does your app appeal to children? | **No** |
| Is your app designed for children? | **No** |

### App Content Declarations

| Declaration | Answer |
|---|---|
| **App access** | Some functionality is restricted (requires account login for messaging, studio, and marketplace) |
| **Ads** | No ads |
| **In-app purchases** | **Yes** — users can purchase tracks, stem licenses, and studio exports (prices range from $0.99 to $1.99 per item). Donations are also accepted. |
| **News** | Not a news app |
| **Government** | Not a government app |
| **Financial** | No financial features (donations and marketplace sales are not financial features) |
| **Health** | No health features |

### In-App Purchases (if applicable)

If you list in-app purchases in the store listing:
1. Go to **Play Console** → **Monetize** → **Products** → **In-app products**
2. Note: Your current TWA uses web-based checkout (Stripe/Base44 Payments), NOT Google Play Billing. Since `playBilling` is disabled in your TWA manifest, you should **not** list Google Play in-app products. Instead, purchases happen through your web checkout flow.
3. For the data safety form, declare "In-app purchases: Yes" since users can buy items through the web checkout.

> **Important**: Google Play's policy requires that digital goods purchased within the app use Google Play Billing. However, since NaliChat is a TWA (Trusted Web Activity) and your checkout is web-based, purchases happen in the browser context. If Google flags this during review, you may need to migrate digital purchases to Google Play Billing or clearly route users to your website for purchases. Monitor your review feedback for any policy notices.

---

## Quick Checklist

- [ ] Google Play Developer account created ($25 fee paid)
- [ ] Identity verified
- [ ] New app created (package ID: `com.nalichat`, category: Music & Audio)
- [ ] App icon uploaded (512×512 PNG)
- [ ] Feature graphic uploaded (1024×500)
- [ ] Phone screenshots uploaded (minimum 2, recommended 8)
- [ ] Short description entered
- [ ] Full description entered
- [ ] Privacy Policy URL added (https://nalichat.org/privacy)
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed
- [ ] Target audience set (13+)
- [ ] App access declared (restricted — requires login)
- [ ] Ads declared (No)
- [ ] AAB downloaded from Codemagic
- [ ] AAB uploaded to Production track
- [ ] Release notes entered
- [ ] Rollout to Production started
- [ ] Wait for Google review (typically 1–7 days for first release)

---

## Troubleshooting

**"Package name mismatch" error on upload**
- Your AAB package ID is `com.nalichat` (set in Codemagic `PACKAGE_ID`). The Play Console app must have been created with this same package ID. If you accidentally created it with a different ID, you must create a new app — package IDs cannot be changed after creation.

**"App signing key mismatch" on subsequent uploads**
- If you opted into Google Play App Signing, use the upload key (your self-signed keystore) for all uploads. Google re-signs with the distribution key. Download the keystore from Codemagic artifacts if needed (passwords: `nalichat-store`, alias: `nalichat`).

**Review rejected for "Missing privacy policy"**
- Ensure the Privacy Policy URL is publicly accessible without login: https://nalichat.org/privacy

**Review rejected for "User-generated content"**
- Ensure your Report Content dialog is functional (it exists on messages and art posts). Google requires a reporting/blocking mechanism for apps with UGC.

**Review rejected for "Data safety"**
- Double-check every data type you collect is declared. If Google finds undeclared data collection (e.g., analytics SDKs), they will reject the update.