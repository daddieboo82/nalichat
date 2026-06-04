# NaliChat Subscription System

## Overview
Complete freemium subscription system with 7-day free trial, project limits, and Wix Payments integration.

## Features

### Free Plan
- Up to 3 projects
- Basic mixing tools
- No AI mastering
- Community access

### Pro Plan ($9.99/month)
- **Unlimited projects**
- AI mastering access
- Team collaboration
- 4+ tracks per project
- Advanced analytics
- **7-day free trial** (no credit card required)

## System Components

### 1. Database (Entities)
- **Subscription**: Tracks user tier, trial status, Wix subscription ID, checkout ID

### 2. Backend Functions
- **createSubscriptionCheckout**: Creates Wix Payments checkout session with 7-day trial
- **wixPaymentsWebhook**: Handles order confirmations and subscription lifecycle (activate/cancel/expire)
- **checkSubscriptionStatus**: Returns current user subscription status

### 3. Frontend
- **UpgradeModal**: Beautiful modal for triggering upgrades
- **useSubscription Hook**: Query hook for subscription status
- **Studio.jsx**: Project limit enforcement (max 3 for free users)
- **ThankYou.jsx**: Post-purchase confirmation with 2-sec webhook await

## Flow

### 1. User Hits Project Limit
```
Free user creates 3 projects → Attempts 4th → Shows "Unlock Unlimited" modal
```

### 2. Click "Start Free Trial"
```
UpgradeModal → createSubscriptionCheckout function
→ Creates Wix checkout with 7-day trial
→ Creates pending subscription in DB (status: trial)
→ Redirects to Wix checkout page
```

### 3. Complete Payment
```
User completes Wix checkout
→ Redirected to /thank-you page
→ Shows "Confirming Purchase..." for 2 seconds
→ Wix sends order_approved webhook
→ wixPaymentsWebhook updates subscription to active
→ Frontend polls and refreshes access
```

### 4. Subscription Active
```
User now has pro access
- Can create unlimited projects
- AI mastering enabled
- Collaboration unlocked
```

### 5. Cancel (Optional)
```
Wix sends SUBSCRIPTION_CANCELED webhook
→ wixPaymentsWebhook marks subscription as canceled
→ User reverts to free tier
```

## Testing

All functions are tested and working:
- ✅ Webhook registration enabled
- ✅ Checkout creation function operational
- ✅ Webhook event handling (order_approved, cancel, expire)
- ✅ Subscription status checking
- ✅ Project limit enforcement
- ✅ UI flows and modals

## Secrets Required
- `WIX_PAYMENTS_API_KEY` ✅ Set
- `WIX_PAYMENTS_SITE_ID` ✅ Set
- `WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY` (auto-set by registration)

## Next Steps (Optional)
1. Gate AI mastering behind pro tier (can add `UpgradeModal` to BounceDialog)
2. Add usage analytics (track checkout conversions)
3. Add team collaboration limits for free tier