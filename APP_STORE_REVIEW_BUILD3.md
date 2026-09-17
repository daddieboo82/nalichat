# NaliChat Messenger — App Review Build 3 Readiness

Status: **DO NOT RESUBMIT** until every verification checkbox below is complete.

## Apple Guideline 2.1 information request

Apple requested additional information because this developer account has limited App Review history. This packet is the source of truth for the response and future App Review Notes.

## App purpose and audience

NaliChat Messenger is a consumer messaging and creator platform. It is intended for people who want to communicate with other users and use NaliChat's creator tools from one account. Core messaging is available without a paid subscription. The app combines messaging, user/creator interaction, NaliStudio creator functionality, and optional enhanced paid features.

## Reviewer access / setup instructions

1. Install and launch the exact submitted iOS build on a supported physical iPhone running the latest public iOS release.
2. Use the App Review demo account supplied in App Store Connect App Review Information. Do **not** put reviewer credentials in this repository.
3. Confirm normal authenticated NaliChat access, Messages/contact discovery, messaging, reporting/blocking, paid-feature behavior, and in-app account deletion.

## External services / platforms

Repository integrations include Base44 application/backend services, Stripe web subscription/payment compatibility paths, Wix legacy payment/webhook compatibility code, and deployed AI/creator integrations. Before submission, compare this with production configuration and list every service materially used for authentication, messaging, storage/media, notifications, payments, analytics/moderation, or AI functionality.

## Physical-device recording required by Apple

Record **one continuous screen recording on a physical iPhone** running the latest public iOS release using the exact candidate build. Show: cold launch; registration/login; normal authenticated experience; Messages/contact discovery; send/receive messaging; UGC report; Block User and blocked-state enforcement; representative NaliStudio/creator use; paid-feature behavior; Settings; and complete in-app account deletion using a disposable QA account.

## QA gate

- [ ] Exact candidate build identified (version/build and source commit).
- [ ] Candidate installed successfully on a supported physical iPhone.
- [ ] Tested on latest public iOS release.
- [ ] Cold launch succeeds.
- [ ] Registration succeeds.
- [ ] Login succeeds with App Review demo credentials.
- [ ] New-user contact list populates correctly.
- [ ] Messaging send/receive succeeds.
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

Automated release gate after the UGC blocking implementation: **694 test files / 1,552 tests passed; lint passed; typecheck passed; production build passed.** This does not substitute for the required physical-device verification.

Candidate version: 1.0

Candidate build: ____________________

Source commit: ____________________

Physical device / iOS: ____________________

QA date: ____________________

QA tester: ____________________

## App Review Notes draft

NaliChat Messenger is a consumer messaging and creator application. Its purpose is to give users a single place for messaging, user/creator interaction, account safety controls, and NaliStudio creator functionality. Core messaging is available without a paid subscription; optional paid features provide enhanced capabilities and limits.

REVIEW ACCESS: Please use the demo credentials entered in the App Review Information username/password fields. The account is configured for normal customer-facing functionality.

TYPICAL FLOW: Launch NaliChat, sign in (or register), open Messages, select a contact/conversation, send a message, and use navigation to access NaliStudio and Settings. Reporting and blocking controls are available from relevant user/content interaction surfaces. Account deletion is available inside the app.

PAID FEATURES: [Replace with exact verified iOS purchase/access behavior for the submitted build, including Apple IAP products if used and storefront-specific behavior.]

EXTERNAL SERVICES: Base44 is used for NaliChat application/backend services. [Add complete verified production service list.]

REGIONS: [State exact verified regional/storefront behavior.]

REGULATED/PROTECTED MATERIAL: NaliChat Messenger is a messaging/creator application and is not submitted as a regulated financial, medical, gambling, or similar regulated service. [If protected third-party material is supplied, identify it and provide authorization documentation.]

PHYSICAL-DEVICE DEMONSTRATION: [Insert accessible recording reference.] The recording starts from app launch and demonstrates typical use, account access, messaging, UGC reporting/blocking, paid-feature access, and in-app account deletion on a physical iPhone running the latest public iOS release.

## Response to App Review draft

Hello App Review,

Thank you for the request for additional information. We completed another QA pass of NaliChat Messenger and added the requested information to the App Review Information Notes field.

A physical-device recording of the exact review build is provided here: [RECORDING REFERENCE]. It begins with launching the app and demonstrates the typical user flow, account access, messaging, user-generated-content reporting/blocking, paid-feature access, and in-app account deletion.

Purpose and audience: NaliChat Messenger is a consumer messaging and creator application for users who want messaging, user/creator interaction, account safety controls, and NaliStudio creator functionality in one application. Core messaging does not require a paid subscription.

Reviewer access: Please use the demo credentials supplied in App Review Information.

External services: [INSERT VERIFIED PRODUCTION SERVICE LIST].

Regional behavior: [INSERT VERIFIED STOREFRONT/REGIONAL STATEMENT].

Regulated/protected material: [INSERT VERIFIED STATEMENT AND DOCUMENTATION REFERENCE IF APPLICABLE].

Thank you.
