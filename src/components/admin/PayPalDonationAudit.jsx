import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

export default function PayPalDonationAudit() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState("");
  const run = async (page = 0) => {
    if (loading || user?.role !== "admin") return;
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("getPayPalDonationAudit", { page });
      const data = response?.data ?? response;
      if (data?.success !== true || data?.action !== "paypal_donation_audit" ||
          data?.adminUserId !== user.id || data?.readOnly !== true ||
          data?.page !== page || !Array.isArray(data.records)) {
        throw new Error(data?.error || "Donation audit response could not be verified");
      }
      setAudit(data);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Donation audit unavailable");
    } finally {
      setLoading(false);
    }
  };
  if (user?.role !== "admin") return null;
  return (
    <section aria-label="PayPal donation audit" className="mb-5 rounded-xl border border-border bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">PayPal donations — provider audit</h3>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void run(0)}>
          {loading ? "Checking PayPal..." : "Check donation status"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Read-only comparison of saved donation orders with PayPal. Does not create orders, capture payments, issue refunds, or modify subscriptions. A provider capture is not proof of bank payout.
      </p>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      {audit && (
        <div role="status" className="mt-3 space-y-3">
          <p className="text-sm">Environment: <strong>{audit.environment}</strong> · PayPal API authentication: <strong>{audit.providerCheck === "authenticated" ? "Confirmed" : "Unavailable"}</strong></p>
          <div className="rounded-lg border border-border bg-card p-3 text-sm">
            <p className="font-semibold">PayPal donation webhook readiness</p>
            <p className="mt-1 text-muted-foreground">
              {audit.webhook?.status === "configured_not_delivery_verified"
                ? "Order approval event and webhook destination configured. Live event delivery is not yet verified."
                : ({
                  provider_unavailable: "PayPal API authentication unavailable.",
                  webhook_id_missing: "PayPal webhook ID is missing.",
                  webhook_lookup_unavailable: "Could not verify the registered PayPal webhook.",
                  webhook_url_mismatch: "PayPal webhook points to a different address.",
                  webhook_disabled: "The registered PayPal webhook is disabled.",
                  approval_event_missing: "CHECKOUT.ORDER.APPROVED is missing from PayPal webhook subscriptions.",
                })[audit.webhook?.status] || "Webhook configuration has not been verified."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">This is a read-only configuration check, not a successful donation or proof of webhook delivery.</p>
          </div>
          <p className="text-xs text-muted-foreground">{audit.records.length} donation record(s) on page {audit.page + 1}.{audit.records.some(item => item.needsReview) ? " Some records need review." : ""}</p>
          {audit.records.length === 0 && (
            <p className="text-sm text-muted-foreground">No PayPal donation orders have been recorded on this page. This does not establish that live checkout or settlement works.</p>
          )}
          {audit.records.some(item => item.providerStatus === "approved_not_captured") && (
            <p role="alert" className="text-sm text-amber-500">One or more donations were approved by PayPal but have no confirmed capture. Investigate before asking a donor to pay again.</p>
          )}
          {audit.records.length > 0 && (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {audit.records.map((item, index) => (
                <div key={item.orderId || index} className="rounded-lg border border-border bg-card p-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{"$" + Number(item.amountUsd).toFixed(2)} USD</span>
                    <span className={item.needsReview ? "text-amber-500" : "text-muted-foreground"}>{item.needsReview ? "Review needed" : "Matched"}</span>
                  </div>
                  <p className="mt-1 break-all text-muted-foreground">Order: {item.orderId}</p>
                  <p className="mt-1">NaliChat: {item.localStatus} · PayPal: {item.providerStatus.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "Date unavailable"}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={loading || audit.page === 0} onClick={() => void run(audit.page - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={loading || !audit.hasMore} onClick={() => void run(audit.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  );
}
