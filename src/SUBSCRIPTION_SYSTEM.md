# NaliChat Subscription System

## Current product model

NaliChat sells one recurring plan for full app access.

- Price: **$19.99 every 30 days**
- Includes: app access, desktop downloads, exports, and stem downloads
- Separate per-item charges are not used for exports or stems

## Frontend behavior

- Public marketing pages remain browsable
- Authenticated app routes require an active subscription
- Pricing starts Stripe subscription checkout
- Thank-you handles subscription success and donation success
- Android and iOS install flows remain free to access
- Windows and macOS downloads are included with app access

## Backend behavior

- `createSubscriptionCheckout` creates the recurring Stripe checkout session
- `checkSubscriptionStatus` determines whether a user has access
- `stripeWebhook` activates and updates subscription records
- `createCheckout` remains for one-time donation support

## Areas to keep aligned

- Pricing page copy
- Settings billing messaging
- Protected route gating
- Download access rules
- Thank-you fulfillment
