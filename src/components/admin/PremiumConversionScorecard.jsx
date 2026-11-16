import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";

const STAGES = [
  ["entitlement_prompt_view", "Welcome offer viewed"],
  ["entitlement_prompt_convert", "Premium plans explored"],
  ["paywall_dismissed", "Continued free"],
  ["paywall_view", "Pricing viewed"],
  ["checkout_started", "PayPal checkout started"],
  ["purchase_completed", "Purchase confirmed in app"],
  ["purchase_failed", "Checkout error recorded"],
];

function countUnique(events, eventName) {
  const identities = new Set();
  for (const event of events) {
    if (event.event_name !== eventName) continue;
    // Missing user/session identifiers are not merged with unrelated events.
    identities.add(event.user_id || event.session_id || event.id);
  }
  return identities.size;
}

export default function PremiumConversionScorecard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  const refresh = async () => {
    if (loading || user?.role !== "admin") return;
    setLoading(true);
    setError("");
    try {
      const cutoff = new Date(Date.now() - 7 * 86400000).getTime();
      const events = [];
      const pageSize = 500;
      let capped = false;
      for (let skip = 0; skip < 2000; skip += pageSize) {
        const batch = await base44.entities.ActivationFunnel.list("-created_date", pageSize, skip);
        if (!Array.isArray(batch)) throw new Error("Funnel records unavailable");
        for (const event of batch) {
          const timestamp = Date.parse(event.created_date || "");
          if (Number.isFinite(timestamp) && timestamp >= cutoff) events.push(event);
        }
        if (batch.length < pageSize || (batch.length && Date.parse(batch[batch.length - 1].created_date || "") < cutoff)) break;
        if (skip + pageSize >= 2000) capped = true;
      }
      const rows = STAGES.map(([key, label]) => ({ key, label, count: countUnique(events, key) }));
      setReport({ rows, capped, readAt: new Date().toLocaleString() });
    } catch {
      setError("Could not load funnel data. No subscription or billing records were changed.");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "admin") return null;
  return (
    <section className="mb-5 rounded-xl border border-border bg-secondary/10 p-4" aria-label="Premium conversion scorecard">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Premium conversion — last 7 days</h3>
        <Button type="button" variant="outline" disabled={loading} onClick={refresh}>
          {loading ? "Loading funnel..." : "Refresh conversion scorecard"}
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">Unique user or session counts per stage. Different stages may involve different people. Purchase events are app-reported, not merchant settlement confirmation.</p>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {report && (
        <div role="status">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {report.rows.map(row => (
              <div className="rounded-lg border border-border bg-card p-3" key={row.key}>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-xl font-bold tabular-nums">{row.count}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Updated: {report.readAt}{report.capped ? " · Latest 2,000 records only; counts may be incomplete" : ""}</p>
        </div>
      )}
    </section>
  );
}
