# NaliChat Monetization Status

## Current product model

NaliChat currently presents itself as a free-to-use app. The frontend no longer treats subscriptions or trials as active user-facing flows.

## Supported monetization

- Optional donations through checkout
- Per-track stem/license purchases from Explore

## Frontend behavior

- Core app features are available without a subscription paywall
- The thank-you page is reachable after public checkout
- Studio exports and app downloads are presented as free flows

## Backend notes

- Legacy subscription webhook and checkout handlers still exist in the repository
- They are not the primary frontend monetization path today

## Areas to keep aligned

- Pricing page copy
- Settings account messaging
- Cart and checkout fulfillment
- Download and export flows
