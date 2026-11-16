import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wrench, Stethoscope, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

// Nali Maintenance Panel — lets the app owner run Nali's diagnostic scan
// and trigger automatic repairs for safe, non-destructive data issues.
export default function NaliMaintenancePanel() {
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // 'diagnose' | 'repair'
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [paypalReconciliationRunning, setPaypalReconciliationRunning] = useState(false);
  const [paypalReconciliationResult, setPaypalReconciliationResult] = useState(null);
  const [paypalAuditLoading, setPaypalAuditLoading] = useState(false);
  const [paypalAudit, setPaypalAudit] = useState(null);
  const [paypalSupportReport, setPaypalSupportReport] = useState("");

  const auditPayPal = async () => {
    if (paypalAuditLoading || mode !== null || user?.role !== "admin") return;
    setPaypalAuditLoading(true);
    setPaypalAudit(null);
    setPaypalSupportReport("");
    try {
      const response = await base44.functions.invoke("getPendingPayPalAudit", {});
      const data = response?.data;
      if (data?.error) throw new Error(data.error);
      if (data?.success !== true || data?.action !== "pending_paypal_audit" ||
          data?.adminUserId !== user.id || !Number.isSafeInteger(data.checked)) {
        throw new Error("PayPal audit response could not be verified.");
      }
      const providerStatuses = {};
      for (const record of Array.isArray(data.results) ? data.results : []) {
        const status = typeof record.status === "string" ? record.status : "unknown";
        providerStatuses[status] = (providerStatuses[status] || 0) + 1;
      }
      const planProblems = Array.isArray(data.planChecks)
        ? data.planChecks.filter((plan) => plan.status !== "ACTIVE" || plan.matchesCatalog !== true).length
        : null;
      // Build an admin-only report from provider lookup evidence. This is never
      // sent automatically or persisted in a customer-visible entity.
      const unresolved = (Array.isArray(data.results) ? data.results : [])
        .filter((record) => record.status === "not_found");
      const lines = [
        "NaliChat PayPal merchant investigation — read-only evidence",
        "PayPal environment: " + String(data.environment || "unknown"),
        "Pending agreement lookups: " + data.checked,
        "HTTP 404 (not found under current credentials): " + unresolved.length,
        "Affected NaliChat accounts: " + (data.uniqueAccounts ?? "unknown"),
        "Please locate these PayPal subscription agreements and identify their owning REST application/merchant account and any associated payment history.",
        "Do not create or restart subscriptions based on this report alone.",
        "",
        "Agreement ID | HTTP status | PayPal debug ID | Local plan | Local creation date",
        ...unresolved.map((record) => [
          record.subscriptionId || "(missing)",
          record.httpStatus || "unknown",
          record.paypalDebugId || "unavailable",
          record.plan || "unknown",
          record.createdDate || "unknown",
        ].join(" | ")),
      ];
      setPaypalSupportReport(lines.join("\n"));
      setPaypalAudit({
        checked: data.checked,
        uniqueAccounts: data.uniqueAccounts,
        multipleAccounts: data.accountsWithMultiplePending,
        missingKeys: data.missingRequestKeys,
        providerStatuses,
        webhook: data.webhookCheck,
        webhookLedgerCount: data.webhookLedgerCount,
        webhookLedgerStates: data.webhookLedgerRecentStates,
        planProblems,
        activeChecks: Array.isArray(data.activeChecks) ? data.activeChecks : [],
        confirmedPayments: Array.isArray(data.results)
          ? data.results.filter((record) => record.identityMatches === true && record.paymentRecorded === true).length : null,
        activePaymentChecks: Array.isArray(data.activeChecks)
          ? data.activeChecks.filter((record) => record.identityMatches === true && record.paymentRecorded === true).length : null,
        accountsWithCheckoutClaims: data.accountsWithCheckoutClaims,
        accountsWithMatchedCheckoutClaims: data.accountsWithMatchedCheckoutClaims,
        accountsWithUnmatchedCheckoutClaims: data.accountsWithUnmatchedCheckoutClaims,
        accountsWithUnknownClaimState: data.accountsWithUnknownClaimState,
        pendingAccountsWithActiveRecord: data.pendingAccountsWithActiveRecord,
        oldestAttempt: data.oldestAttempt,
      });
    } catch (error) {
      toast.error("PayPal audit failed: " + (error?.response?.data?.error || error?.message || "Unknown error"));
    } finally {
      setPaypalAuditLoading(false);
    }
  };

  const reconcilePayPal = async () => {
    if (paypalReconciliationRunning || mode !== null || user?.role !== "admin") return;
    if (!window.confirm("Check pending PayPal subscriptions against PayPal now? This may activate customer-approved agreements and update verified subscription statuses. It will not create new checkout agreements.")) return;
    setPaypalReconciliationRunning(true);
    setPaypalReconciliationResult(null);
    try {
      const response = await base44.functions.invoke("reconcilePendingPayPal", {});
      const data = response?.data;
      if (data?.error) throw new Error(data.error);
      if (data?.success !== true || data?.action !== "reconcile_pending_paypal" ||
          !Number.isSafeInteger(data.checked) || !Number.isSafeInteger(data.updated) ||
          data.checked < 0 || data.updated < 0 || data.updated > data.checked) {
        throw new Error("PayPal reconciliation response could not be verified.");
      }
      setPaypalReconciliationResult({ checked: data.checked, updated: data.updated,
        reviewRequired: Array.isArray(data.results) ? data.results.filter((item) => item.result === "identity_review_required").length : 0,
        lookupFailed: Array.isArray(data.results) ? data.results.filter((item) => item.result === "paypal_lookup_failed").length : 0,
        agreementFailures: Array.isArray(data.results) ? data.results.filter((item) => item.result === "agreement_check_failed").length : 0,
      });
      toast.success("PayPal status check completed.");
    } catch (error) {
      toast.error("PayPal status check failed: " + (error?.response?.data?.error || error?.message || "Unknown error"));
    } finally {
      setPaypalReconciliationRunning(false);
    }
  };

  const run = async (repairMode) => {
    if (mode) return;
    const runMode = repairMode ? 'repair' : 'diagnose';
    setMode(runMode);
    setResult(null);
    setShowDetails(false);
    try {
      const res = await base44.functions.invoke('nali-maintenance', { mode: runMode });
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        !res?.data ||
        res.data.success !== true ||
        res.data.adminUserId !== user?.id ||
        res.data.mode !== runMode ||
        typeof res.data.totalIssues !== 'number' ||
        !Number.isFinite(res.data.totalIssues) ||
        res.data.totalIssues < 0
      ) {
        throw new Error("Maintenance response was invalid");
      }
      setResult(res.data);
      if (repairMode) {
        toast.success(`Nali repaired ${res.data.totalFixed || 0} issue${(res.data.totalFixed || 0) === 1 ? '' : 's'}.`);
      } else {
        toast.success(`Nali found ${res.data.totalIssues || 0} issue${(res.data.totalIssues || 0) === 1 ? '' : 's'}.`);
      }
    } catch (e) {
      toast.error("Maintenance scan failed: " + (e.message || "unknown error"));
    } finally {
      setMode(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 mb-8">
      <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
        <Wrench className="w-5 h-5 text-primary" />
        Nali Maintenance & Repair
      </h2>
      <p className="text-sm text-muted-foreground mb-4">
        Nali can scan the entire app for data issues — broken records, stale statuses, out-of-sync counts — and automatically repair safe, non-destructive problems across every entity.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <Button
          variant="outline"
          onClick={() => run(false)}
          disabled={mode !== null}
          className="gap-2"
        >
          {mode === "diagnose" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
          Diagnose Only
        </Button>
        <Button
          onClick={() => run(true)}
          disabled={mode !== null}
          className="gap-2"
        >
          {mode === "repair" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
          Diagnose & Repair
        </Button>
      </div>

      {user?.role === "admin" && (
        <div className="mb-5 border-t border-border pt-4">
          <h3 className="mb-2 text-base font-semibold">PayPal subscription recovery</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            Manually check pending PayPal agreements when scheduled reconciliation is unavailable.
            Only PayPal-verified subscriptions are updated; customer-approved agreements may be activated.
            This does not start a new subscription checkout.
          </p>
          <Button variant="outline" className="mb-3 mr-3 gap-2" disabled={mode !== null || paypalAuditLoading || paypalReconciliationRunning} onClick={auditPayPal}>
            {paypalAuditLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
            {paypalAuditLoading ? "Checking PayPal configuration..." : "Audit PayPal (read-only)"}
          </Button>
          {paypalAudit && (
            <div role="status" className="mb-3 space-y-2 rounded-lg border border-border p-3 text-sm">
              <p>Pending agreements checked: {paypalAudit.checked}. Affected accounts: {paypalAudit.uniqueAccounts ?? "unknown"}.</p>
              <p>Accounts with multiple pending agreements: {paypalAudit.multipleAccounts ?? "unknown"}. Legacy records without checkout keys: {paypalAudit.missingKeys ?? "unknown"}.</p>
              <p>PayPal webhook: {paypalAudit.webhook?.status || "unverified"}; enabled status: {paypalAudit.webhook?.enabled === true ? "explicitly enabled" : paypalAudit.webhook?.enabled === false ? "explicitly disabled" : "not provided by PayPal"}; expected URL: {paypalAudit.webhook?.urlMatchesExpected === true ? "matches" : "not confirmed"}.</p>
              <p>Registered callback route: {paypalAudit.webhook?.registeredRoute === "dispatcher" ? "Base44 dispatcher" : paypalAudit.webhook?.registeredRoute === "public_domain" ? "NaliChat public domain" : paypalAudit.webhook?.registeredRoute === "other" ? "different URL — review in PayPal" : "not verified"}. This classification does not confirm that PayPal can deliver events.</p>
              {paypalAudit.webhook?.status === "registered" && (paypalAudit.webhook.enabled === false || paypalAudit.webhook.urlIsHttps !== true || paypalAudit.webhook.urlMatchesExpected !== true || (paypalAudit.webhook.missingEvents?.length || 0) > 0) && (
                <p role="alert" className="text-amber-600">Webhook configuration needs review: check HTTPS callback, URL matching and required event subscriptions in PayPal. Webhook delivery still needs a successful event test.</p>
              )}
              <p>Webhook ledger entries: {paypalAudit.webhookLedgerCount ?? "unavailable"}. Paid plan configuration issues: {paypalAudit.planProblems ?? "unavailable"}.</p>
              {paypalAudit.webhookLedgerCount === 0 && (
                <p role="alert" className="text-amber-600">No PayPal webhook events have been recorded. This does not prove delivery failed. Verify the webhook URL and subscribed events, then check PayPal delivery history before assuming payment activation is working. PayPal does not expose a top-level enabled flag in this API response.</p>
              )}
              <p>Checkout claims on affected accounts: {paypalAudit.accountsWithCheckoutClaims ?? "unknown"}; matched: {paypalAudit.accountsWithMatchedCheckoutClaims ?? "unknown"}; unmatched: {paypalAudit.accountsWithUnmatchedCheckoutClaims ?? "unknown"}; unreadable account claims: {paypalAudit.accountsWithUnknownClaimState ?? "unknown"}.</p>
              <p>Accounts with both active and pending PayPal records: {paypalAudit.pendingAccountsWithActiveRecord ?? "unknown"}. Oldest pending attempt: {paypalAudit.oldestAttempt || "unknown"}.</p>
              <p>Pending agreements with provider-reported last payment: {paypalAudit.confirmedPayments ?? "unknown"}. Active records with provider-reported last payment: {paypalAudit.activePaymentChecks ?? "unknown"}. A missing payment field means unknown, not unpaid.</p>
              <p>Active agreement checks: {paypalAudit.activeChecks.length ? Object.entries(paypalAudit.activeChecks.reduce((counts, record) => { const key = record.status || "unknown"; counts[key] = (counts[key] || 0) + 1; return counts; }, {})).map(([status, count]) => status + ": " + count).join(", ") : "none available"}.</p>
              <p>Provider agreement statuses: {Object.entries(paypalAudit.providerStatuses).map(([key, count]) => `${key}: ${count}`).join(", ") || "none available"}.</p>
              {paypalSupportReport && (
                <Button type="button" variant="outline" className="min-h-11 whitespace-normal text-left"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(paypalSupportReport);
                      toast.success("Merchant support report copied.");
                    } catch {
                      toast.error("Could not copy automatically. Open this page in a secure browser and retry.");
                    }
                  }}>
                  Copy PayPal merchant investigation report
                </Button>
              )}
              <p className="text-muted-foreground">This audit only reads PayPal and local records. No payments or subscription statuses are changed.</p>
            </div>
          )}
          <Button variant="outline" className="gap-2" disabled={mode !== null || paypalReconciliationRunning} onClick={reconcilePayPal}>
            {paypalReconciliationRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Stethoscope className="w-4 h-4" />}
            {paypalReconciliationRunning ? "Checking PayPal..." : "Reconcile pending PayPal"}
          </Button>
          {paypalReconciliationResult && (
            <p role="status" className="mt-3 text-sm text-muted-foreground">
              Checked {paypalReconciliationResult.checked} pending agreement(s), updated {paypalReconciliationResult.updated}.
              {paypalReconciliationResult.reviewRequired > 0 ? ` ${paypalReconciliationResult.reviewRequired} need identity review.` : ""}
              {paypalReconciliationResult.lookupFailed > 0 ? ` ${paypalReconciliationResult.lookupFailed} provider lookups failed.` : ""}
              {paypalReconciliationResult.agreementFailures > 0 ? ` ${paypalReconciliationResult.agreementFailures} agreement checks failed; review before retrying.` : ""}
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Summary badges */}
          <div className="flex flex-wrap gap-3">
            <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 ${result.totalIssues > 0 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600' : 'bg-green-500/10 border-green-500/20 text-green-600'}`}>
              {result.totalIssues > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              <span className="text-sm font-bold">{result.totalIssues} issue{result.totalIssues === 1 ? '' : 's'} found</span>
            </div>
            {result.mode === 'repair' && (
              <div className="px-4 py-2 rounded-lg border bg-primary/10 border-primary/20 text-primary flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                <span className="text-sm font-bold">{result.totalFixed} repaired</span>
              </div>
            )}
          </div>

          {/* Scanned entities */}
          {result.scanned && Object.keys(result.scanned).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Records Scanned</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.scanned).map(([key, count]) => (
                  <span key={key} className="text-xs bg-secondary/50 px-2 py-1 rounded-md border border-border/50">
                    {key}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Issues by entity */}
          {result.issuesByEntity && Object.keys(result.issuesByEntity).length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Issues by Entity</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.issuesByEntity).map(([entity, count]) => (
                  <span key={entity} className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-1 rounded-md border border-yellow-500/20">
                    {entity}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Detailed issue list */}
          {result.issues && result.issues.length > 0 && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1 hover:text-foreground transition-colors"
              >
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Issue Details ({result.issues.length}{result.totalIssues > result.issues.length ? ` of ${result.totalIssues}` : ''})
              </button>
              {showDetails && (
                <div className="space-y-1.5 max-h-64 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] pr-2">
                  {result.issues.map((iss, i) => (
                    <div key={i} className="text-xs bg-secondary/30 border border-border/50 rounded-md px-3 py-2 flex items-start gap-2">
                      <span className="font-mono text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">{iss.entity}</span>
                      <span className="text-muted-foreground">{iss.issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Fixed list */}
          {result.mode === 'repair' && result.fixed && result.fixed.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary mb-2">Repaired</p>
              <div className="space-y-1.5 max-h-64 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] pr-2">
                {result.fixed.map((f, i) => (
                  <div key={i} className="text-xs bg-green-500/5 border border-green-500/20 rounded-md px-3 py-2 flex items-start gap-2">
                    <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
                    <span className="font-mono text-[10px] text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded shrink-0">{f.entity}</span>
                    <span className="text-muted-foreground">{f.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.totalIssues === 0 && (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              All clear — Nali found no issues across the entire app.
            </p>
          )}
        </div>
      )}
    </div>
  );
}