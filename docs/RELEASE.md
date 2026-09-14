# NaliChat Production Release Runbook

## Release candidate requirements

Before publishing, the exact commit intended for production must pass:

```bash
npm run verify:release
npm audit --omit=dev
npm run test:e2e
```

Expected results:

- lint passes
- typecheck passes
- full Vitest suite passes
- production build passes
- production dependency audit reports zero known vulnerabilities
- all runnable Playwright smoke tests pass
- authenticated Playwright cases may only be skipped when the required test-account credentials are unavailable

Record the release SHA:

```bash
git rev-parse HEAD
```

## Publish through Base44

Authenticate the Base44 CLI if needed, then publish the frontend:

```bash
npx base44 site deploy --build -y
```

Do not treat a timed-out CLI invocation as a successful deployment. Confirm completion before proceeding.

## Verify the live deployment

After Base44 reports a successful publish, verify that nalichat.org serves the tested commit:

```bash
npm run verify:prod
```

This command fetches the live entry bundle with cache-busting and confirms that it contains the embedded build SHA.

A non-zero result means production is stale or the wrong build was published.

## Post-deploy smoke

Run:

```bash
npm run test:e2e
```

Then verify these production routes return successfully:

- /
- /login
- /register
- /messages
- /files
- /studio
- /settings

Protected routes should redirect anonymous users through the normal login flow rather than expose protected data.

## Release blockers

Do not call the release complete while any of these are true:

- `npm run verify:release` fails
- `npm audit --omit=dev` reports production vulnerabilities
- runnable Playwright smoke tests fail
- `npm run verify:prod` reports production drift
- Base44 publish has not completed successfully
- a newly introduced security or authorization regression is unresolved

## GitHub Actions note

GitHub Actions currently has a repository-level startup failure documented in issue #1018. The failure occurs before any workflow job is created. Until GitHub resolves that infrastructure/settings problem, Base44/local release verification is the source of release evidence rather than a green Actions run.
