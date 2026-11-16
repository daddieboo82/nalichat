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

// A single customer may retry checkout many times. Do not present retries
// as separate people, and do not label anonymous sessions as known customers.
export function eventIdentity(event) {
  const userId = event.user_id || event.metadata?.user_id;
  if (typeof userId === "string" && userId.trim()) return "user:" + userId.trim();
  const sessionId = event.session_id || event.metadata?.product_session_id;
  if (typeof sessionId === "string" && sessionId.trim()) return "session:" + sessionId.trim();
  return "event:" + String(event.id || event.created_date || Math.random());
}

export function summarizePremiumEvents(events, name) {
  const matching = events.filter(event => event.event_name === name);
  const identities = new Set(matching.map(eventIdentity));
  const knownCustomers = new Set(matching.map(event => event.user_id || event.metadata?.user_id).filter(Boolean));
  return { attempts: matching.length, identities: identities.size, knownCustomers: knownCustomers.size };
}

export function recoveredCheckoutCustomers(events) {
  const purchases = new Map();
  for (const event of events) {
    if (event.event_name !== "purchase_completed") continue;
    const userId = event.user_id || event.metadata?.user_id;
    if (userId) purchases.set(userId, Math.max(purchases.get(userId) || 0, Date.parse(event.created_date || "") || 0));
  }
  const recovered = new Set();
  for (const event of events) {
    if (event.event_name !== "purchase_failed") continue;
    const userId = event.user_id || event.metadata?.user_id;
    const when = Date.parse(event.created_date || "") || 0;
    if (userId && purchases.has(userId) && purchases.get(userId) > when) recovered.add(userId);
  }
  return recovered.size;
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
      const rows = STAGES.map(([key, label]) => ({ key, label, ...summarizePremiumEvents(events, key) }));
      const recovered = recoveredCheckoutCustomers(events);
      setReport({ rows, recovered, capped, readAt: new Date().toLocaleString() });
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
      <p className="mb-3 text-xs text-muted-foreground">Attempts and distinct users/sessions are shown separately, so repeated checkout errors from one customer are not counted as multiple customers. Purchase events are app-reported, not PayPal settlement confirmation.</p>
      {error && <p role="alert" className="mb-3 text-sm text-destructive">{error}</p>}
      {report && (
        <div role="status">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {report.rows.map(row => (
              <div className="rounded-lg border border-border bg-card p-3" key={row.key}>
                <p className="text-xs text-muted-foreground">{row.label}</p>
                <p className="text-xl font-bold tabular-nums">{row.attempts} <span className="text-xs font-normal text-muted-foreground">events</span></p>
                <p className="mt-1 text-xs text-muted-foreground">{row.identities} distinct users/sessions · {row.knownCustomers} identified users</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Customers with a checkout-error event followed by a purchase event within this window: <strong>{report.recovered}</strong>. This is not proof of payment settlement.</p>
          <p className="mt-2 text-xs text-muted-foreground">Updated: {report.readAt}{report.capped ? " · Latest 2,000 records only; counts may be incomplete" : ""}</p>
        </div>
      )}
    </section>
  );
}
