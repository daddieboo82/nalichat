# NaliChat PayPal reconciliation: safe scheduler migration

Status: **BLOCKED — do not unpause recurring checkout or deploy reconciliation changes before the gates below pass.**

## Observed state (2026-11-14)

- Live Base44 app: `6a1f5ee134147461560c2b37`.
- Live scheduled workflow: `PayPal Pending Reconciliation` (`6ab70c152d1c1bcb345963c4`), recurring every 15 minutes, UTC.
- The live workflow definition passes a static `workflow_key` in task arguments. That literal was also previously stored in repository source and **must be treated as exposed**.
- The latest 12 workflow runs inspected on 2026-11-14 were all **cancelled** for `insufficient_credits` with **zero executed steps**. Do not confuse active scheduling with successful reconciliation.
- Draft `reconcilePendingPayPal/main.ts` and `entry.ts` now accept a sufficiently long `PAYPAL_RECONCILE_WORKFLOW_KEY` from Base44 runtime secrets, while allowing authenticated, unrestricted administrators.
- The `PAYPAL_RECONCILE_WORKFLOW_KEY` secret name was **not found** among configured Base44 app secrets.
- Base44 isolated branch command execution previously returned HTTP 402, so tests have **not** run. Draft PR #1048 is not merged/deployed.

## Required no-leak migration sequence

1. **Treat the old literal workflow key as compromised.** Do not reuse it in another endpoint or workflow.
2. **Prove the scheduler's service identity.** Determine from official Base44 workflow documentation or a safe sandbox test whether an `invoke_backend_function` action authenticates to `createClientFromRequest(req)` as a privileged service principal, and how to verify that identity against a documented trusted claim. Never assume a request body or `workflow_key` establishes identity.
3. **Avoid secrets in workflow definitions.** Workflow definitions, version history and run logs may expose task input arguments. Do **not** paste the new `PAYPAL_RECONCILE_WORKFLOW_KEY` secret into `definition.do[].run_function.with.args` or a URL. Secret storage alone does not make a workflow argument confidential.
4. **Choose a validated authentication mechanism.** Prefer a documented and verified platform-provided service identity for the scheduled workflow. If the workflow cannot securely carry a service identity or read a secret at execution without embedding it in the stored definition, **do not re-enable unattended reconciliation**; require audited administrator initiation until supported.
5. **Fail closed on deployment.** Before publishing any draft code, confirm that all scheduled invocations use the new trusted authorization model. The current draft secret check will reject the existing live workflow key; deploying it without a caller migration will break unattended reconciliation.
6. **Prove staging behavior:** unauthorized caller denied; missing/placeholder key denied; valid trusted principal authorized; provider agreement ID/plan/environment matched; no duplicate activation; failed lookups do not alter subscription records; repeated/out-of-order events remain safe.
7. **Validate an actual scheduled run and replay** in isolated staging with telemetry showing the function executed and the expected read/write decisions. Verify PayPal provider-side outcomes and webhook delivery independently.
8. **Publish only after checkout-reservation atomicity, provider webhook verification, rollback strategy and successful CI/staging proof.** Keep the checkout hard stop in place until then.

## Operational verification

Read-only checks:
- List workflow state and latest runs using Base44 workflows API.
- Confirm `status == completed` AND executed step count > 0 for meaningful run evidence; status `active` on the schedule alone is insufficient.
- Inspect authentication failures and reconciliation results without printing credentials, workflow keys, full event payloads or private customer information.

**Do not** trigger `run-now`, edit the production workflow definition, update its secrets, merge the PR, deploy, or change customer access merely to verify this migration plan.
