import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Webhook, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function WebhookTest() {
  const [loading, setLoading] = useState(false);
  const [subscriptions, setSubscriptions] = useState([]);
  const [fetchingSubs, setFetchingSubs] = useState(true);
  const queryClient = useQueryClient();

  const fetchSubscriptions = async () => {
    setFetchingSubs(true);
    try {
      const user = await base44.auth.me();
      if (user) {
        const subs = await base44.entities.Subscription.filter({ user_id: user.id });
        setSubscriptions(subs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingSubs(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const createMockActiveSubscription = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      if (user) {
        await base44.entities.Subscription.create({
          user_id: user.id,
          plan: "pro",
          status: "active",
          subscription_id: "mock-sub-" + Date.now(),
        });
        await fetchSubscriptions();
        toast.success("Created mock active subscription");
        queryClient.removeQueries({ queryKey: ['subscription'] });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to create mock subscription");
    } finally {
      setLoading(false);
    }
  };

  const createMockPendingSubscription = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      if (user) {
        await base44.entities.Subscription.create({
          user_id: user.id,
          plan: "pro",
          status: "pending",
          checkout_id: "mock-checkout-" + Date.now(),
        });
        await fetchSubscriptions();
        toast.success("Created mock pending subscription");
        queryClient.removeQueries({ queryKey: ['subscription'] });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to create mock pending subscription");
    } finally {
      setLoading(false);
    }
  };

  const clearAllSubscriptions = async () => {
    setLoading(true);
    try {
      const user = await base44.auth.me();
      if (user) {
        const subs = await base44.entities.Subscription.filter({ user_id: user.id });
        await Promise.all(subs.map(sub => base44.entities.Subscription.delete(sub.id)));
        await fetchSubscriptions();
        toast.success("Cleared all subscriptions");
        queryClient.removeQueries({ queryKey: ['subscription'] });
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to clear subscriptions");
    } finally {
      setLoading(false);
    }
  };

  const removeSubscription = async (id) => {
    try {
      setLoading(true);
      await base44.entities.Subscription.delete(id);
      toast.success("Subscription removed");

      setSubscriptions(prev => prev.filter(s => s.id !== id));

      setTimeout(() => {
        fetchSubscriptions();
        queryClient.removeQueries({ queryKey: ['subscription'] });
      }, 1000);
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove subscription");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-3xl mx-auto p-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/20 rounded-xl">
          <Webhook className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-bold">Backend Testing Interface</h1>
          <p className="text-muted-foreground">Manage test subscriptions and Stripe webhook events</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Subscription Management</CardTitle>
              <CardDescription>
                Create mock subscriptions for testing. Real subscriptions are activated by the Stripe webhook when a checkout completes.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={createMockActiveSubscription} disabled={loading} variant="outline" size="sm" className="shrink-0">
                Add Mock Active Sub
              </Button>
              <Button onClick={createMockPendingSubscription} disabled={loading} variant="outline" size="sm" className="shrink-0">
                Add Mock Pending Sub
              </Button>
              <Button onClick={clearAllSubscriptions} disabled={loading} variant="destructive" size="sm" className="shrink-0">
                Clear All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {fetchingSubs ? (
              <div className="flex items-center text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Fetching subscriptions...
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded-lg">
                No subscriptions found for your account. Start a checkout flow or add a mock subscription above.
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-secondary/30 border border-border rounded-lg">
                    <div>
                      <div className="font-mono text-xs text-muted-foreground mb-1">ID: {sub.id}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold capitalize">{sub.plan} Plan</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          sub.status === 'active' ? 'bg-green-500/20 text-green-500' :
                          sub.status === 'pending' ? 'bg-yellow-500/20 text-yellow-500' :
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {sub.status}
                        </span>
                      </div>
                      {sub.checkout_id && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Checkout: {sub.checkout_id}
                        </div>
                      )}
                      {sub.subscription_id && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Stripe Sub: {sub.subscription_id}
                        </div>
                      )}
                    </div>
                    <Button
                      onClick={() => removeSubscription(sub.id)}
                      disabled={loading}
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-red-500 shrink-0"
                      title="Remove Entry"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Stripe Webhook Setup</CardTitle>
            <CardDescription>
              To test real webhook events, register the endpoint in your Stripe Dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded shrink-0">1</span>
                <p>Go to <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-primary inline-flex items-center gap-1 hover:underline">Stripe Dashboard → Webhooks <ExternalLink className="w-3 h-3" /></a></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded shrink-0">2</span>
                <p>Add endpoint: <code className="text-primary bg-secondary px-1.5 py-0.5 rounded text-xs">https://nalichat.base44.app/functions/stripeWebhook</code></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded shrink-0">3</span>
                <p>Subscribe to events: <code className="text-xs">checkout.session.completed</code>, <code className="text-xs">customer.subscription.updated</code>, <code className="text-xs">customer.subscription.deleted</code>, <code className="text-xs">invoice.paid</code>, <code className="text-xs">invoice.payment_failed</code></p>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-mono text-xs bg-secondary px-2 py-1 rounded shrink-0">4</span>
                <p>Copy the signing secret (<code className="text-xs">whsec_...</code>) and set it as the <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> app secret</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}