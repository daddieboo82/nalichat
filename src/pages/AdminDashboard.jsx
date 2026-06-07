import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, DollarSign, Users, Activity, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    base44.auth.me()
      .then(setCurrentUser)
      .catch(() => {})
      .finally(() => setIsLoadingUser(false));
  }, []);

  const { data: subscriptions = [], isLoading: isLoadingSubs } = useQuery({
    queryKey: ["allSubscriptions"],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getAdminDashboardStats', {});
        return res.data?.subscriptions || [];
      } catch (e) {
        console.error(e);
        return [];
      }
    },
    enabled: currentUser?.role === 'admin',
  });

  if (isLoadingUser || (currentUser?.role === 'admin' && isLoadingSubs)) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[50vh]">
        <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p>You do not have permission to view the business dashboard.</p>
      </div>
    );
  }

  // Calculate metrics
  const activeSubs = subscriptions.filter(sub => sub.status === 'active');
  const proSubs = activeSubs.filter(sub => sub.plan === 'pro');
  const proFilesharingSubs = activeSubs.filter(sub => sub.plan === 'pro_filesharing');

  // MRR Calculation
  const mrr = (proSubs.length * 24.95) + (proFilesharingSubs.length * 49.95);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col min-h-[calc(100vh-6rem)] pb-32 md:pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-heading font-black flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-primary" />
          Business Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Revenue reporting and subscription metrics for NaliChat.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
          <h3 className="text-lg font-bold text-muted-foreground">Pro / Pro+ Filesharing</h3>
          <p className="text-4xl font-black mt-2">
            {proSubs.length} <span className="text-xl text-muted-foreground">/</span> {proFilesharingSubs.length}
          </p>
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
    </div>
  );
}