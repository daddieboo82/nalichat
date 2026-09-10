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

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

Run unit/integration tests: `npm test`

Run browser end-to-end tests:
1. Install Playwright browsers: `npx playwright install --with-deps chromium`
2. Execute e2e suite: `npm run test:e2e`

**Messaging performance budget**

- Load or switch conversations without entrance animations for the historical batch or locally restored outbound queue.
- Animate a realtime or locally composed message at most once, using opacity/transform only; refetches and duplicate reconciliation events must not replay it.
- Keep composer keystrokes independent of message-list animation work, with stable callbacks and memoized message grouping so typing does not rebuild avoidable per-message props.
- Keep processing per realtime event bounded to the active conversation and its current cache. The existing query cap is 200 messages; that full 200-message view must remain usable on low-end mobile without historical animation churn.
- Treat delivery state, retry controls, focus indicators, typing text, and read receipts as essential UI. Reduced motion may remove transitions but must not hide these states.
- Before release, manually exercise a 200-message conversation on a low-end or throttled mobile profile: switch conversations, type continuously, receive a realtime message, replay a duplicate/refetch event, retry a failed send, and verify responsive interaction without claiming an FPS result unless it was measured.

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
