import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Webhook, CheckCircle2, AlertCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export default function WebhookTest() {
  const [loading, setLoading] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [result, setResult] = useState(null);
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
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
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
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
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
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
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
      await fetchSubscriptions();
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    } catch (e) {
      console.error(e);
      toast.error("Failed to remove subscription");
    } finally {
      setLoading(false);
    }
  };

  const simulateSubscriptionCanceled = async (subscriptionId) => {
    setLoadingId(subscriptionId);
    setResult(null);
    try {
      const payload = {
        eventType: "wix.ecom.subscription_contracts.v1.subscription_contract_canceled",
        data: JSON.stringify({
          actionEvent: {
            body: {
              subscriptionContract: {
                id: subscriptionId
              }
            }
          }
        })
      };

      const res = await base44.functions.invoke("wixPaymentsWebhook", {
        isTestBypass: true,
        payload: payload
      });

      if (res.data?.success) {
        setResult({ success: true, message: "Cancel webhook successfully processed and acknowledged." });
        toast.success("Cancel webhook processed successfully");
        await fetchSubscriptions();
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      } else {
        setResult({ success: false, message: res.data?.error || "Webhook failed to process." });
        toast.error("Webhook processing failed");
      }
    } catch (error) {
      setResult({ success: false, message: error.message || "Network error" });
      toast.error("Error triggering webhook");
    } finally {
      setLoadingId(null);
    }
  };

  const simulateOrderApproved = async (checkoutId) => {
    setLoadingId(checkoutId);
    setResult(null);
    try {
      const payload = {
        eventType: "wix.ecom.v1.order_approved",
        data: JSON.stringify({
          actionEvent: {
            body: {
              order: {
                checkoutId: checkoutId,
                lineItems: [
                  {
                    subscriptionInfo: { id: "test-sub-" + Date.now() }
                  }
                ]
              }
            }
          }
        })
      };

      const res = await base44.functions.invoke("wixPaymentsWebhook", {
        isTestBypass: true,
        payload: payload
      });

      if (res.data?.success) {
        setResult({ success: true, message: "Webhook successfully processed and acknowledged." });
        toast.success("Webhook processed successfully");
        await fetchSubscriptions();
        queryClient.invalidateQueries({ queryKey: ['subscription'] });
      } else {
        setResult({ success: false, message: res.data?.error || "Webhook failed to process." });
        toast.error("Webhook processing failed");
      }
    } catch (error) {
      setResult({ success: false, message: error.message || "Network error" });
      toast.error("Error triggering webhook");
    } finally {
      setLoadingId(null);
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
          <p className="text-muted-foreground">Manage and test incoming webhooks</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Webhook Simulation</CardTitle>
              <CardDescription>
                Simulate webhook events for your subscriptions (e.g. approve pending orders or cancel active subscriptions).
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
                No subscriptions found for your account. Please start a checkout flow first.
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
                    </div>
                    
                    {sub.status === 'pending' && (sub.checkout_id || sub.id) && (
                      <Button 
                        onClick={() => simulateOrderApproved(sub.checkout_id || sub.id)} 
                        disabled={loadingId === (sub.checkout_id || sub.id)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 shrink-0"
                      >
                        {loadingId === (sub.checkout_id || sub.id) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Approve Order
                      </Button>
                    )}
                    {sub.status === 'active' && (
                      <Button 
                        onClick={() => simulateSubscriptionCanceled(sub.subscription_id || sub.id)} 
                        disabled={loadingId === (sub.subscription_id || sub.id)}
                        variant="destructive"
                        className="shrink-0"
                      >
                        {loadingId === (sub.subscription_id || sub.id) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Cancel Subscription
                      </Button>
                    )}
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

            {result && (
              <div className={`mt-6 p-4 rounded-lg flex items-start gap-3 border ${
                result.success ? 'bg-green-500/10 border-green-500/20 text-green-500' : 'bg-red-500/10 border-red-500/20 text-red-500'
              }`}>
                {result.success ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-semibold">{result.success ? 'Success' : 'Error'}</div>
                  <div className="text-sm opacity-90">{result.message}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}