import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { base44 } from "@/api/base44Client";

export default function UpgradeModal({ open, onOpenChange, triggerReason = "projects" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleUpgrade = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await base44.functions.invoke("createSubscriptionCheckout", {});
      if (response.data?.checkoutUrl) {
        // Use window.open to maintain session, fallback to direct nav
        const popup = window.open(response.data.checkoutUrl, '_blank');
        if (!popup) {
          // Popup blocked, do direct navigation
          window.location.href = response.data.checkoutUrl;
        }
      } else {
        const errorMsg = response.data?.error || response.data?.details || "Failed to start checkout";
        setError(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
        setLoading(false);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err.response?.data?.error || err.message || "Checkout failed. Please try again.");
      setLoading(false);
    }
  };

  const reasons = {
    projects: {
      title: "Unlock Unlimited Projects",
      description: "You've reached the 3-project limit on the free plan.",
      feature: "Create unlimited projects",
    },
    aiMastering: {
      title: "Unlock AI Mastering",
      description: "AI mastering is available exclusively to Pro members.",
      feature: "AI-powered professional mastering",
    },
    collaboration: {
      title: "Unlock Collaboration",
      description: "Project collaboration is a Pro feature.",
      feature: "Invite collaborators and work together",
    },
    studio: {
      title: "Unlock NaliStudio Pro",
      description: "NaliStudio Pro is an exclusive feature.",
      feature: "Full studio access",
    },
    coverart: {
      title: "Unlock AI Cover Art",
      description: "AI Cover Art Creator is an exclusive Pro feature.",
      feature: "Generate AI cover art",
    },
    analytics: {
      title: "Unlock Analytics",
      description: "Advanced analytics are exclusive to Pro members.",
      feature: "Detailed audience insights",
    },
  };

  const reason = reasons[triggerReason] || reasons.projects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center font-heading text-xl">{reason.title}</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground mt-2">
            {reason.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
            <p className="text-sm font-semibold text-foreground">NaliChat Pro includes:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ Unlimited projects</li>
              <li>✓ {reason.feature}</li>
              <li>✓ Team collaboration & permissions</li>
              <li>✓ 4+ tracks per project</li>
              <li>✓ Advanced analytics</li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
            <p className="text-center text-sm font-semibold text-accent">
              Upgrade to NaliChat Pro
            </p>
            <p className="text-center text-xs text-muted-foreground mt-1">
              $9.99/month. Cancel anytime.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Not Now
            </Button>
            <Button
              className="flex-1 rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white font-semibold"
              onClick={handleUpgrade}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Upgrade Now
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}