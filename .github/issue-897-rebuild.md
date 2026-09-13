# Issue #897 rebuild

This branch is a clean rebuild from current main for production-readiness verification.

## Acceptance gate
- GitHub Actions creates real jobs (no synthetic BuildFailed/startup_failure).
- Lint, typecheck, unit tests, production build, and Playwright pass.
- Authenticated production E2E passes for login/register, onboarding, Messages/DM send-receive, file workflows, Studio, Settings/subscription, account switching/cache isolation, and mobile messaging/navigation.

Issue: #897
