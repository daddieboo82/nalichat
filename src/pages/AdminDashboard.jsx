import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, DollarSign, Users, Activity, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    enabled: !!currentUser,
  });

  const { data: users = [], isLoading: isLoadingUsers, refetch: refetchUsers } = useQuery({
    queryKey: ["allUsers"],
    queryFn: async () => {
      try {
        // Will only succeed to fetch all users if current user is admin
        return await base44.entities.User.list();
      } catch (e) {
        return [];
      }
    },
    enabled: !!currentUser && currentUser.role === 'admin',
  });

  if (isLoadingUser || isLoadingSubs || (currentUser?.role === 'admin' && isLoadingUsers)) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldAlert className="w-12 h-12 mb-4 opacity-50 text-red-500" />
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p>You must be an administrator to view this page.</p>
      </div>
    );
  }

  // Calculate metrics
  const activeSubs = subscriptions.filter(sub => sub.status === 'active');
  const proSubs = activeSubs.filter(sub => sub.plan === 'pro');
  const proFilesharingSubs = activeSubs.filter(sub => sub.plan === 'pro_filesharing');

  // MRR Calculation
  const mrr = (proSubs.length * 24.95) + (proFilesharingSubs.length * 49.95);

  const handleToggleRole = async (userId, currentRole) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await base44.entities.User.update(userId, { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      refetchUsers();
    } catch (e) {
      toast.error("Failed to update user role");
    }
  };

  return (
    <div className="h-full overflow-y-auto w-full">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 flex flex-col min-h-max pb-32 md:pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-heading font-black flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Admin Panel
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage users, revenue reporting, and subscription metrics.
        </p>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-6 bg-secondary/50 p-1 rounded-xl">
          <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary">Overview</TabsTrigger>
          {currentUser.role === 'admin' && (
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary">User Management</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-8 mt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </TabsContent>

        {currentUser.role === 'admin' && (
          <TabsContent value="users" className="mt-0">
            <div className="bg-card border border-border rounded-xl p-6">
              <h2 className="text-xl font-bold mb-4 border-b border-border pb-2 flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Manage Users
              </h2>
              {users.length === 0 ? (
                <p className="text-muted-foreground">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-secondary/50">
                      <tr>
                        <th className="px-4 py-3">User</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-4 py-3 font-medium">{u.full_name || 'Unnamed User'}</td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                              u.role === 'admin' ? 'bg-accent/20 text-accent' : 'bg-secondary text-secondary-foreground'
                            }`}>
                              {(u.role || 'user').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {u.id !== currentUser.id && (
                              <button
                                onClick={() => handleToggleRole(u.id, u.role || 'user')}
                                className="text-xs text-primary hover:underline font-medium"
                              >
                                {u.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
      </div>
    </div>
  );
}