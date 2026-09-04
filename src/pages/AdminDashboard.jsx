import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, DollarSign, Users, Activity, Loader2, UserPlus, ShieldAlert, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import NaliMaintenancePanel from "@/components/admin/NaliMaintenancePanel";

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [adminEmail, setAdminEmail] = useState("");
  const [isMakingAdmin, setIsMakingAdmin] = useState(false);
  const [adminProRecognition, setAdminProRecognition] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(setCurrentUser)
      .catch(() => {})
      .finally(() => setIsLoadingUser(false));
  }, []);

  const { data: stats = { subscriptions: [], users: [] }, isLoading: isLoadingSubs } = useQuery({
    queryKey: ["allStats"],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getAdminDashboardStats', {});
        return res.data || { subscriptions: [], users: [] };
      } catch (e) {
        console.error(e);
        return { subscriptions: [], users: [] };
      }
    },
    enabled: !!currentUser,
  });

  const subscriptions = stats.subscriptions || [];
  const users = stats.users || [];

  if (isLoadingUser || isLoadingSubs) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

  // Calculate metrics
  const activeSubs = subscriptions.filter(sub => sub.status === 'active');
  const proSubs = activeSubs.filter(sub => sub.plan === 'pro');
  const proFilesharingSubs = activeSubs.filter(sub => sub.plan === 'pro_filesharing');

  const now = new Date();
  const trialUsers = users.filter(u => {
    const createdDate = new Date(u.created_date);
    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
    const hasTrialFree = diffDays <= 7;
    const userSubs = subscriptions.filter(s => s.user_id === u.id && s.status === 'active');
    return hasTrialFree && userSubs.length === 0 && u.role !== 'admin';
  });

  // MRR Calculation
  const mrr = (proSubs.length * 24.95) + (proFilesharingSubs.length * 49.95);

  const handleMakeAdmin = async () => {
    if (!adminEmail) return;
    setIsMakingAdmin(true);
    try {
      const res = await base44.functions.invoke("makeAdmin", { email: adminEmail });
      if (res.data?.success) {
        toast.success(`${adminEmail} is now an admin!`);
        setAdminEmail("");
      } else {
        toast.error(res.data?.error || "Failed to make admin");
      }
    } catch (e) {
      toast.error("Error calling makeAdmin");
    } finally {
      setIsMakingAdmin(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col min-h-max pb-32 md:pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-black flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          Business Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Revenue reporting and subscription metrics for NaliChat.
        </p>
      </div>

      {currentUser.role !== 'admin' && (
        <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3 text-yellow-600">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold">Not an Admin</h3>
            <p className="text-sm opacity-90">You are currently viewing this dashboard as a regular user. For automated testing, use the "Make Me Admin (Automated Testing)" button below to promote your account.</p>
          </div>
        </div>
      )}

      <NaliMaintenancePanel />

      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
          <Settings className="w-5 h-5 text-primary" />
          Global Access Settings
        </h2>
        <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-secondary/20 mb-8">
          <div>
            <h3 className="font-bold">Admin Pro Recognition</h3>
            <p className="text-sm text-muted-foreground">Automatically recognize all admin users as having a Pro plan, regardless of their actual subscription status.</p>
          </div>
          <Switch 
            checked={adminProRecognition} 
            onCheckedChange={(val) => {
              setAdminProRecognition(val);
              toast.success(val ? "Admin users will now automatically receive Pro plan access." : "Admin Pro recognition disabled.");
            }} 
          />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-8 mt-8">
        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          User Management
        </h2>
        <div className="max-w-md">
          <p className="text-sm text-muted-foreground mb-4">Grant admin privileges to a user by their email address.</p>
          <div className="flex gap-2 mb-4">
            <Input 
              placeholder="user@example.com" 
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
            <Button onClick={handleMakeAdmin} disabled={isMakingAdmin || !adminEmail}>
              {isMakingAdmin ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Make Admin
            </Button>
          </div>
          {currentUser && currentUser.role !== 'admin' && (
            <Button 
              variant="outline" 
              className="w-full sm:w-auto"
              title="Promote to Admin (Automated Testing)"
              onClick={async () => {
                setIsMakingAdmin(true);
                try {
                  await base44.auth.updateMe({ role: 'admin' });
                  toast.success(`You are now an admin! Please refresh the page.`);
                  setTimeout(() => window.location.href = window.location.href, 1000);
                } catch (e) {
                  toast.error("Error updating role: " + e.message);
                } finally {
                  setIsMakingAdmin(false);
                }
              }}
              disabled={isMakingAdmin}
            >
              Make Me Admin (Automated Testing)
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <DollarSign className="w-10 h-10 text-green-500 mb-4" />
          <h3 className="text-lg font-bold text-muted-foreground">Monthly Recurring Revenue</h3>
          <p className="text-4xl font-black mt-2">${mrr.toFixed(2)}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Users className="w-10 h-10 text-primary mb-4" />
          <h3 className="text-lg font-bold text-muted-foreground">Active Subscriptions</h3>
          <p className="text-4xl font-black mt-2">{activeSubs.length}</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Activity className="w-10 h-10 text-accent mb-4" />
          <h3 className="text-lg font-bold text-muted-foreground">Pro / Pro+ Sharing</h3>
          <p className="text-4xl font-black mt-2">
            {proSubs.length} <span className="text-xl text-muted-foreground">/</span> {proFilesharingSubs.length}
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <Activity className="w-10 h-10 text-yellow-500 mb-4" />
          <h3 className="text-lg font-bold text-muted-foreground">Active Free Trials</h3>
          <p className="text-4xl font-black mt-2 text-yellow-500">{trialUsers.length}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6">
        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2">Recent Subscriptions</h2>
        {subscriptions.length === 0 ? (
          <p className="text-muted-foreground">No subscriptions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                <tr>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.slice().reverse().map((sub) => (
                  <tr key={sub.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="px-4 py-3 font-mono text-xs">{sub.user_id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        sub.plan === 'pro_filesharing' ? 'bg-primary/20 text-primary' :
                        sub.plan === 'pro' ? 'bg-accent/20 text-accent' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {sub.plan.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                        sub.status === 'active' ? 'bg-green-500/20 text-green-500' :
                        sub.status === 'trial' ? 'bg-yellow-500/20 text-yellow-500' :
                        'bg-red-500/20 text-red-500'
                      }`}>
                        {sub.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(sub.created_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mt-8">
        <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          All Users & Access Status
        </h2>
        {users.length === 0 ? (
          <p className="text-muted-foreground">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                <tr>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Access Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {users.slice().reverse().map((u) => {
                  const now = new Date();
                  const createdDate = new Date(u.created_date);
                  const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
                  const hasTrialFree = diffDays <= 7;
                  
                  const userSubs = subscriptions.filter(s => s.user_id === u.id && (s.status === 'active' || s.status === 'trial'))
                    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
                  const activeSub = userSubs[0];
                  
                  let planDisplay = "FREE";
                  let planClass = "bg-secondary text-secondary-foreground";
                  
                  if (u.role === 'admin') {
                    planDisplay = "PRO (ADMIN)";
                    planClass = "bg-primary/20 text-primary";
                  } else if (activeSub) {
                    if (activeSub.plan === 'pro_filesharing') {
                      planDisplay = "PRO FILESHARING";
                      planClass = "bg-primary/20 text-primary";
                    } else if (activeSub.plan === 'pro') {
                      planDisplay = "PRO ACTIVE";
                      planClass = "bg-accent/20 text-accent";
                    } else if (activeSub.plan === 'trial') {
                      const trialEnds = new Date(activeSub.trial_end_date);
                      if (trialEnds > now) {
                        planDisplay = "TRIAL ACTIVE";
                        planClass = "bg-yellow-500/20 text-yellow-500";
                      }
                    }
                  } else if (hasTrialFree) {
                    planDisplay = "FREE TRIAL - FREE ACCESS";
                    planClass = "bg-accent/20 text-accent";
                  }

                  return (
                    <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                      <td className="px-4 py-3 font-mono text-xs" title={u.id}>{u.id.slice(0, 8)}...</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3 capitalize">{u.role || 'user'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${planClass}`}>
                          {planDisplay}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(u.created_date).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
    </div>
  );
}