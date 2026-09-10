# NaliChat Monetization Status

## Current product model

NaliChat currently presents itself as a free-to-use app. The frontend no longer treats subscriptions or trials as active user-facing flows.

## Supported monetization

- Optional donations through checkout
- Per-track stem/license purchases from Explore
- Windows desktop download for $9.99
- macOS desktop download for $9.99

## Frontend behavior

- Core app features are available without a subscription paywall
- The thank-you page is reachable after public checkout
- Studio exports remain free
- Android and iOS install flows remain free
- Windows and macOS desktop downloads use one-time checkout

## Backend notes

- Legacy subscription webhook and checkout handlers still exist in the repository
- They are not the primary frontend monetization path today

## Areas to keep aligned

- Pricing page copy
- Settings account messaging
- Cart and checkout fulfillment
- Download and export flows
