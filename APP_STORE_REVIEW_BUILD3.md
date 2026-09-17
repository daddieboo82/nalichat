# NaliChat Messenger — App Review Build 3 Readiness

Status: **DO NOT RESUBMIT** until every verification checkbox below is complete.

## Apple Guideline 2.1 information request

Apple requested additional information because this developer account has limited App Review history. This packet is the source of truth for the response and future App Review Notes.

## App purpose and audience

NaliChat Messenger is a consumer messaging and creator platform. It is intended for people who want to communicate with other users and use NaliChat's creator tools from one account. Core messaging is available without a paid subscription. The app combines messaging, user/creator interaction, NaliStudio creator functionality, and optional enhanced paid features.

Value provided: users can communicate, manage their account and safety controls, and access creator-oriented tools without switching between separate NaliChat products.

## Reviewer access / setup instructions

1. Install and launch the exact submitted iOS build on a supported physical iPhone running the latest public iOS release.
2. Use the App Review demo account supplied in App Store Connect App Review Information. Do **not** put reviewer credentials in this repository.
3. Confirm the account opens the normal authenticated NaliChat experience without requiring developer-only setup.
4. Open Messages and exercise a typical messaging flow.
5. Exercise user-generated-content safety controls, including reporting and blocking another user/content where available.
6. Open the plan/paid-feature experience and verify the purchasing behavior that is enabled for the submitted iOS storefront/build.
7. Open account/settings controls and complete the in-app account deletion flow using a disposable QA account.

If multiple account roles are exposed to ordinary App Store customers, provide a separate working reviewer account for each role in App Store Connect Notes.

## External services / platforms

The repository currently contains integrations or compatibility code for services including:

- Base44 — application backend/platform services and data access.
- Stripe — web subscription/payment processing and billing compatibility paths.
- Wix — legacy payment/webhook compatibility code; not the primary new subscription flow.
- AI/creator service integrations configured by the deployed NaliChat environment for NaliStudio or other AI-assisted functionality.

Before submitting, compare this list with production environment configuration and add every production service that materially delivers authentication, messaging, storage/media, notifications, payments, analytics, moderation, or AI functionality. Do not claim a service is used merely because dormant code exists in the repository.

## Regional behavior

Do not tell App Review that behavior is identical in every region until purchase behavior has been verified for the submitted build and storefront configuration. Digital-purchase rules can differ by storefront. App Review Notes must describe the actual production behavior of the submitted iOS build.

## Regulated industry / protected third-party material

NaliChat Messenger is being presented as a messaging/creator application, not as a regulated financial, medical, gambling, or similar regulated service. Do not claim ownership or authorization for protected third-party material that has not been verified. If production content includes licensed/protected material supplied by NaliChat, attach the relevant authorization in App Store Connect when required.

## Physical-device recording required by Apple

Record **one continuous screen recording on a physical iPhone** running the latest public iOS release. It must use the exact build intended for review.

Recording sequence:

1. Begin recording before launching NaliChat.
2. Launch NaliChat from the iPhone Home Screen.
3. Show registration or login.
4. Show the typical authenticated landing experience.
5. Open Messages, populate/select a contact/conversation, send a message, and demonstrate the normal messaging flow.
6. Demonstrate user-generated-content safety: report content/user and block a user. Show confirmation/state change without exposing private third-party information.
7. Show NaliStudio/creator functionality representative of normal use.
8. Show the paid-feature/plan screen and the purchase/access flow actually available in the submitted iOS build. Do not make a real unintended charge.
9. Show Settings/account management.
10. Using a disposable QA account, demonstrate in-app account deletion from initiation through the final confirmation/result.

Do not substitute simulator, browser, mockup, promotional video, or edited marketing footage for this recording.

## Screenshot verification — Guideline 2.3.3 prevention

Before submission verify every App Store screenshot:

- is captured from the current app UI;
- primarily shows the app in use, not only a splash/login/title image;
- accurately represents features available in the submitted build;
- contains no obsolete UI or misleading paid-feature behavior;
- matches the required device screenshot dimensions in App Store Connect.

## Paid feature verification — Guideline 3.1.1 prevention

The current repository has Premium and Premium Plus monthly/yearly subscription SKUs and a web/Stripe checkout implementation. Before review, explicitly verify the submitted iOS behavior against the App Store rules and the storefronts where the app will be distributed.

Do not state that Apple In-App Purchase is configured unless the corresponding App Store Connect products exist, are attached to the version/submission as required, and a physical-device/TestFlight purchase test has passed.

Do not state that Stripe is available in every storefront unless the submitted build's behavior and applicable App Store rules have been verified for those storefronts.

## QA gate

- [ ] Exact candidate build identified (version/build number and source commit recorded below).
- [ ] Candidate installed successfully on a supported physical iPhone.
- [ ] Tested on latest public iOS release.
- [ ] Cold launch succeeds.
- [ ] Registration succeeds.
- [ ] Login succeeds with App Review demo credentials.
- [ ] New-user contact list populates correctly.
- [ ] Messaging send/receive flow succeeds.
- [ ] UGC reporting succeeds.
- [ ] User blocking succeeds and blocked state is enforced.
- [ ] NaliStudio/creator representative flow succeeds.
- [ ] Paid-feature access/purchase path is App-Store-compliant for enabled storefronts.
- [ ] Restore/manage-subscription behavior verified if Apple IAP is present.
- [ ] Account deletion succeeds from inside the app using a disposable account.
- [ ] Privacy/support links open successfully.
- [ ] All submitted screenshots recaptured/verified against candidate build.
- [ ] Continuous physical-device recording completed and reviewed.
- [ ] App Review demo credentials retested immediately before submission.
- [ ] App Review Notes contain all six requested information categories.
- [ ] Recording supplied to App Review using an accessible method accepted by App Store Connect.
- [ ] No known crash, blocker, placeholder, test-only UI, or stale metadata remains.

Candidate version: 1.0

Candidate build: ____________________

Source commit: ____________________

Physical device / iOS: ____________________

QA date: ____________________

QA tester: ____________________

## App Review Notes draft

NaliChat Messenger is a consumer messaging and creator application. Its purpose is to give users a single place for messaging, user/creator interaction, account safety controls, and NaliStudio creator functionality. Core messaging is available without a paid subscription; optional paid features provide enhanced capabilities and limits.

REVIEW ACCESS: Please use the demo credentials entered in the App Review Information username/password fields. The account is configured for normal customer-facing functionality. [Add additional role credentials here only if needed.]

TYPICAL FLOW: Launch NaliChat, sign in (or register), open Messages, select a contact/conversation, send a message, and use the navigation to access creator/NaliStudio and Settings features. Reporting and blocking controls are available from the relevant user/content interaction surfaces. Account deletion is available inside the app from account/settings controls.

PAID FEATURES: [Before submission, replace this bracketed text with the exact verified iOS purchase/access behavior for the submitted build, including Apple IAP products if used and any storefront-specific behavior.]

EXTERNAL SERVICES: Base44 is used for NaliChat application/backend services. [Add the complete verified production list here, including authentication, storage/media, notifications, payments, analytics/moderation and AI providers actually used by this build.]

REGIONS: [Before submission, state the exact verified regional/storefront behavior. Do not claim global consistency until verified.]

REGULATED/PROTECTED MATERIAL: NaliChat Messenger is a messaging/creator application and is not submitted as a regulated financial, medical, gambling, or similar regulated service. [If NaliChat itself supplies protected third-party material, identify it and provide authorization documentation; otherwise state that no such protected third-party material is supplied by the app.]

PHYSICAL-DEVICE DEMONSTRATION: [Insert the accessible recording reference supplied to App Review.] The recording starts from app launch and demonstrates typical use, account access, messaging, UGC safety controls, paid-feature access, and in-app account deletion on a physical iPhone running the latest public iOS release.

## Response to App Review draft

Hello App Review,

Thank you for the request for additional information. We completed another QA pass of NaliChat Messenger and added the requested information to the App Review Information Notes field.

A physical-device recording of the exact review build is provided here: [RECORDING REFERENCE]. It begins with launching the app and demonstrates the typical user flow, account access, messaging, user-generated-content reporting/blocking, paid-feature access, and in-app account deletion.

Purpose and audience: NaliChat Messenger is a consumer messaging and creator application for users who want messaging, user/creator interaction, account safety controls, and NaliStudio creator functionality in one application. Core messaging does not require a paid subscription.

Reviewer access: Please use the demo credentials supplied in App Review Information. [Add any additional role-specific instructions if applicable.]

External services: [INSERT VERIFIED PRODUCTION SERVICE LIST].

Regional behavior: [INSERT VERIFIED STOREFRONT/REGIONAL STATEMENT].

Regulated/protected material: [INSERT VERIFIED STATEMENT AND DOCUMENTATION REFERENCE IF APPLICABLE].

Thank you.
