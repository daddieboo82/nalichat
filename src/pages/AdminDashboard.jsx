import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Users,
  Activity,
  Loader2,
  UserPlus,
  ShieldAlert,
  Crown,
  Clock3,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import NaliMaintenancePanel from "@/components/admin/NaliMaintenancePanel";
import { createCheckoutRequestKey, startSubscriptionCheckout } from "@/lib/subscriptionBilling";

const EMPTY_STATS = {
  totalUsers: 0,
  totalSubscriptions: 0,
  activeSubscriptions: 0,
  trialSubscriptions: 0,
  pendingSubscriptions: 0,
  canceledSubscriptions: 0,
  premiumSubscriptions: 0,
  premiumPlusSubscriptions: 0,
};

export default function AdminDashboard() {
  const { user: currentUser, isLoadingAuth: isLoadingUser, authError } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [isMakingAdmin, setIsMakingAdmin] = useState(false);
  const [testSku, setTestSku] = useState("premium_monthly");
  const [isStartingTestPurchase, setIsStartingTestPurchase] = useState(false);

  const {
    data: stats = EMPTY_STATS,
    isLoading: isLoadingStats,
    isError: statsError,
    refetch,
  } = useQuery({
    queryKey: ["adminDashboardStats", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("getAdminDashboardStats", {});
      if (res?.data?.error) throw new Error(res.data.error);
      if (
        res?.data?.success !== true ||
        res?.data?.adminUserId !== currentUser?.id ||
        !res?.data?.stats ||
        typeof res.data.stats !== "object"
      ) {
        throw new Error("Admin dashboard response was not confirmed.");
      }
      return res.data.stats;
    },
    enabled: currentUser?.role === "admin",
    retry: false,
  });

  const {
    data: billingTestStatus,
    isLoading: isLoadingBillingTestStatus,
    isError: billingTestStatusError,
    refetch: refetchBillingTestStatus,
  } = useQuery({
    queryKey: ["billingTestStatus", currentUser?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke("getBillingTestStatus", {});
      const payload = res?.data ?? res;
      if (
        payload?.success !== true ||
        payload?.action !== "billing_test_status" ||
        payload?.adminUserId !== currentUser?.id
      ) {
        throw new Error(payload?.error || "Billing test status was not confirmed.");
      }
      return payload;
    },
    enabled: currentUser?.role === "admin",
    retry: false,
  });

  if (isLoadingUser || (currentUser?.role === "admin" && isLoadingStats)) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (authError) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[50vh]">
        <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Dashboard unavailable</h2>
        <p>We couldn't verify your account. Refresh and try again.</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[50vh]">
        <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p>Please log in to view the business dashboard.</p>
      </div>
    );
  }

  if (currentUser.role !== "admin") {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Admins Only</h2>
        <p>You don&apos;t have permission to view the business dashboard.</p>
      </div>
    );
  }

  const handleTestPurchase = async () => {
    if (!billingTestStatus?.testMode || !billingTestStatus?.priceCatalogReady) return;
    setIsStartingTestPurchase(true);
    try {
      await startSubscriptionCheckout({
        sku: testSku,
        idempotencyKey: createCheckoutRequestKey(),
        cancelDestination: "pricing",
        expectedUserId: currentUser.id,
      });
    } catch (error) {
      toast.error(error?.message || "Could not start test purchase.");
      setIsStartingTestPurchase(false);
    }
  };

  const handleMakeAdmin = async () => {
    const email = adminEmail.trim();
    if (!email) return;
    setIsMakingAdmin(true);
    try {
      const res = await base44.functions.invoke("makeAdmin", { email });
      if (
        res?.data?.success === true &&
        res?.data?.action === "promote_admin" &&
        res?.data?.adminUserId === currentUser?.id &&
        typeof res?.data?.targetUserId === "string" &&
        res.data.targetUserId &&
        res?.data?.email === email &&
        res?.data?.role === "admin"
      ) {
        toast.success(`${email} is now an admin!`);
        setAdminEmail("");
      } else {
        toast.error(res?.data?.error || "Admin promotion was not confirmed");
      }
    } catch {
      toast.error("Error calling makeAdmin");
    } finally {
      setIsMakingAdmin(false);
    }
  };

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users },
    { label: "Active Subscriptions", value: stats.activeSubscriptions, icon: Activity },
    { label: "Trials", value: stats.trialSubscriptions, icon: Clock3 },
    { label: "Premium Plus", value: stats.premiumPlusSubscriptions, icon: Crown },
  ];

  return (
    <div className="h-full min-h-0 overflow-y-auto touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] w-full">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col min-h-max pb-32 md:pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-black flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Business Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Server-authoritative account and subscription health metrics for NaliBase.
          </p>
        </div>

        <NaliMaintenancePanel />

        {statsError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 mb-6">
            <p className="font-semibold text-destructive">Could not load dashboard metrics.</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!statsError && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {cards.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-card border border-border rounded-xl p-6">
                  <Icon className="w-8 h-8 text-primary mb-4" />
                  <h3 className="text-sm font-bold text-muted-foreground">{label}</h3>
                  <p className="text-4xl font-black mt-2">{value ?? 0}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm text-muted-foreground">Premium</p>
                <p className="text-2xl font-bold">{stats.premiumSubscriptions ?? 0}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm text-muted-foreground">Pending checkout</p>
                <p className="text-2xl font-bold">{stats.pendingSubscriptions ?? 0}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm text-muted-foreground">Canceled / ended</p>
                <p className="text-2xl font-bold">{stats.canceledSubscriptions ?? 0}</p>
              </div>
            </div>
          </>
        )}

        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-primary" />
            Make a Test Purchase
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Starts NaliBase&apos;s real subscription checkout using Stripe test mode. This replaces the legacy Base44/Wix test-purchase screen.
          </p>

          {isLoadingBillingTestStatus ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking billing test configuration...
            </div>
          ) : billingTestStatusError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-sm font-semibold text-destructive">Could not verify billing test mode.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetchBillingTestStatus()}>
                Retry
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 mb-4 text-sm">
                <span className={`rounded-full border px-3 py-1 font-semibold ${billingTestStatus?.testMode ? "border-green-500/30 bg-green-500/10 text-green-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>
                  Stripe: {billingTestStatus?.environment || "unconfigured"}
                </span>
                <span className={`rounded-full border px-3 py-1 font-semibold ${billingTestStatus?.priceCatalogReady ? "border-green-500/30 bg-green-500/10 text-green-600" : "border-amber-500/30 bg-amber-500/10 text-amber-600"}`}>
                  Price catalog: {billingTestStatus?.priceCatalogReady ? "ready" : "incomplete"}
                </span>
              </div>

              {!billingTestStatus?.testMode && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4 text-sm">
                  Test purchases are disabled because the configured Stripe secret key is not a test key. No live checkout will be launched from this panel.
                </div>
              )}

              {billingTestStatus?.missingPriceSecrets?.length > 0 && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 mb-4 text-sm">
                  <p className="font-semibold mb-2">Missing or invalid test price IDs:</p>
                  <ul className="list-disc pl-5 space-y-1">
                    {billingTestStatus.missingPriceSecrets.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 sm:items-end max-w-2xl">
                <label className="flex-1 text-sm font-medium">
                  Test plan
                  <select
                    className="mt-2 min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={testSku}
                    onChange={(e) => setTestSku(e.target.value)}
                  >
                    <option value="premium_monthly">Premium — Monthly</option>
                    <option value="premium_yearly">Premium — Yearly</option>
                    <option value="premium_plus_monthly">Premium Plus — Monthly</option>
                    <option value="premium_plus_yearly">Premium Plus — Yearly</option>
                  </select>
                </label>
                <Button
                  onClick={handleTestPurchase}
                  disabled={!billingTestStatus?.testMode || !billingTestStatus?.priceCatalogReady || isStartingTestPurchase}
                  className="gap-2 min-h-11"
                >
                  {isStartingTestPurchase ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  Make a test purchase
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            User Management
          </h2>
          <div className="max-w-md">
            <p className="text-sm text-muted-foreground mb-4">
              Grant admin privileges by email. Promotion is verified server-side and only existing admins can perform it.
            </p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="user@example.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
              />
              <Button onClick={handleMakeAdmin} disabled={isMakingAdmin || !adminEmail.trim()}>
                {isMakingAdmin
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <UserPlus className="w-4 h-4 mr-2" />}
                Make Admin
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
