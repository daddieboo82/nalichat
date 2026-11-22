import { Home } from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  const location = useLocation();
  const { user, isAuthenticated, authChecked } = useAuth();

  if (location.pathname.toLowerCase().replace(/\/+$/, '') === '/admin-dashboard') {
    return <Navigate to={'/admin' + location.search + location.hash} replace />;
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-5">
      <div className="w-full min-w-0 max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">Page Not Found</h1>
        <p className="text-sm text-muted-foreground">
          No page is available at <span className="break-all font-medium text-foreground">{location.pathname}</span>.
        </p>
        <Button asChild className="min-h-12 w-full rounded-xl">
          <Link to="/"><Home aria-hidden="true" className="mr-2 h-4 w-4" />Go Home</Link>
        </Button>
        {authChecked && isAuthenticated && user?.role === 'admin' && (
          <aside className="rounded-xl border border-border bg-card p-3 text-left text-sm">
            <p className="font-medium text-foreground">Admin Note</p>
            <p className="mt-1 text-muted-foreground">If you expected this page to exist, check its route and deployment configuration.</p>
          </aside>
        )}
      </div>
    </main>
  );
}
