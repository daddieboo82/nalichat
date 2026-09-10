import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shown when an initial page load fails.
 *
 * Several pages used to `await` their data with no try/catch, so a rejected
 * request skipped `setLoading(false)` and left a spinner on screen forever with
 * no explanation and no way out. This gives those failures a visible cause and
 * a retry button.
 */
export default function LoadError({
  title = "Couldn't load this page",
  message = 'Something went wrong while fetching the latest data.',
  onRetry,
  className = 'p-8',
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center gap-3 ${className}`}>
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="w-6 h-6 text-destructive" />
      </div>
      <div>
        <h2 className="font-heading font-bold text-lg">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2 mt-1">
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      )}
    </div>
  );
}
