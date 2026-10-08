import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error Boundary caught:", error, errorInfo);
  }

  // Clear all lazy-import retry flags and force a hard reload so the browser
  // re-fetches all chunks fresh — the most reliable recovery from a stale or
  // wedged dev server that served a broken dynamically imported module.
  handleTryAgain = () => {
    try {
      Object.keys(sessionStorage)
        .filter((key) => key.startsWith('nali:lazy-retry:'))
        .forEach((key) => sessionStorage.removeItem(key));
    } catch {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // When a custom fallback is provided (e.g. null for non-critical components
      // like the AI assistant), render it instead of the full-screen error page.
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="font-heading font-bold text-2xl mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">An unexpected error occurred. Please try again.</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleTryAgain}>Try Again</Button>
              <Button onClick={() => window.location.href = "/"}>Back to Home</Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}