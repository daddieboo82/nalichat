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
            Server-authoritative account and subscription health metrics for NaliChat.
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
