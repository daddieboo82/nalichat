import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Webhook, ExternalLink, ShieldAlert } from "lucide-react";

export default function WebhookTest() {
  const { user: currentUser, isLoadingAuth, authError } = useAuth();
  const {
    data: subscriptions = [],
    isLoading: fetchingSubs,
  } = useQuery({
    queryKey: ["webhookTestSubscriptions", currentUser?.id],
    queryFn: () => base44.entities.Subscription.filter({ user_id: currentUser.id }),
    enabled: currentUser?.role === "admin",
    retry: false,
  });

  if (isLoadingAuth) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (authError || !currentUser || currentUser.role !== "admin") {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Admins Only</h2>
        <p>This diagnostics interface is restricted to administrators.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl mx-auto p-6 py-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary/20 rounded-xl">
          <Webhook className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-bold">Backend Diagnostics</h1>
          <p className="text-muted-foreground">Read-only subscription and Stripe webhook diagnostics</p>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Subscription State</CardTitle>
            <CardDescription>
              Read-only view of subscription records for your admin account. Billing state is managed only by server-side checkout, webhook, and migration functions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fetchingSubs ? (
              <div className="flex items-center text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Fetching subscriptions...
              </div>
            ) : subscriptions.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-secondary/50 rounded-lg">
                No subscription records found for your account.
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map((sub) => (
                  <div key={sub.id} className="p-4 bg-secondary/30 border border-border rounded-lg">
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
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Stripe Webhook Setup</CardTitle>
            <CardDescription>
              Configure real webhook events in Stripe. This page does not create, modify, or delete subscription records.
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
                <p>Set the Stripe signing secret as the <code className="text-xs">STRIPE_WEBHOOK_SECRET</code> app secret.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
