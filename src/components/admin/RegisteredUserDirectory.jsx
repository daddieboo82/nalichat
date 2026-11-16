import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisteredUserDirectory() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [queryEmail, setQueryEmail] = useState("");
  const [page, setPage] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async (search, nextPage = 0) => {
    if (loading || user?.role !== "admin") return;
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("adminFindRegisteredUsers", { email: search, page: nextPage });
      const data = response?.data ?? response;
      if (data?.success !== true || data?.action !== "admin_find_registered_users" ||
          data?.adminUserId !== user.id || !Array.isArray(data.users) || data.page !== nextPage) {
        throw new Error(data?.error || "User directory response could not be verified.");
      }
      setResult(data);
      setQueryEmail(search);
      setPage(nextPage);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || "Unable to load registered users.");
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== "admin") return null;
  return (
    <section aria-label="Registered user directory" className="mb-5 rounded-xl border border-border bg-secondary/10 p-4">
      <h3 className="text-base font-semibold">Registered users in Base44</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Read-only directory of NaliChat's native Base44 User accounts. Search by exact registration email or browse newest accounts. This does not create, alter, or invite users.
      </p>
      <form className="mt-3 flex flex-wrap gap-2" onSubmit={event => {
        event.preventDefault();
        void load(email.trim().toLowerCase(), 0);
      }}>
        <Input aria-label="Registration email" type="email" className="min-w-[180px] flex-1" value={email}
          placeholder="Search exact registration email" onChange={event => setEmail(event.target.value)} />
        <Button type="submit" disabled={loading}>{loading ? "Checking..." : "Find users"}</Button>
        <Button type="button" variant="outline" disabled={loading} onClick={() => { setEmail(""); void load("", 0); }}>Recent users</Button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {result && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-muted-foreground">
            {result.exactEmailSearch ? "Exact-email lookup" : "Newest registrations"} · Page {page + 1}
          </p>
          {result.users.length ? (
            <div className="max-h-80 space-y-1.5 overflow-auto">
              {result.users.map(record => (
                <div key={record.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-border bg-card p-2 text-xs">
                  <div className="min-w-0">
                    <p className="break-all font-medium">{record.email || "Email unavailable"}</p>
                    <p className="text-muted-foreground">{record.displayName || "Display name not set"}</p>
                  </div>
                  <div className="text-right text-muted-foreground">
                    <p>{record.onboardingCompleted ? "Onboarding complete" : "Setup incomplete"} · {record.role}</p>
                    <p>{record.createdAt ? new Date(record.createdAt).toLocaleString() : "Registration date unavailable"}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No matching records on this page.</p>}
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="outline" disabled={loading || page === 0}
              onClick={() => void load(queryEmail, page - 1)}>Previous page</Button>
            <Button type="button" size="sm" variant="outline" disabled={loading || !result.hasMore}
              onClick={() => void load(queryEmail, page + 1)}>Next page</Button>
          </div>
        </div>
      )}
    </section>
  );
}
