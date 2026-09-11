**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Use Node.js `>=20.19.0`
4. Install dependencies: `npm install`
5. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
VITE_PAYWALL_ENABLED=true
VITE_PAYWALL_VARIANT=auto

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

`VITE_PAYWALL_ENABLED=false` disables paid checkout UI while leaving Free chat
available. `VITE_PAYWALL_VARIANT` accepts `auto`, `A`, or `B`; `auto` assigns and
persists a stable variant per user. Subscription prices, trial eligibility, and
entitlements remain server-owned.

Run the app: `npm run dev`

Run unit/integration tests: `npm test`

Run browser end-to-end tests:
1. Install Playwright browsers: `npx playwright install --with-deps chromium`
2. Execute e2e suite: `npm run test:e2e`

**Premium conversation export**

Premium and Premium Plus members can export a conversation from its More
Options menu as Markdown or PDF. The authenticated `exportConversation`
function verifies both current membership and the canonical `chat.export`
entitlement before returning normalized export data; clients never submit raw
messages or participant IDs.

Exports include message timestamps, edited markers, reply/thread context, and
attachment links plus metadata. Hard-deleted messages are absent, soft-deleted
records are labeled, and unsupported media is not embedded. PDF content is
written as plain text locally, while temporary download object URLs are always
revoked. Each export is capped at the first 5,000 messages and reports when that
limit is reached.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
