import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export default function UpgradeModal({ open, onOpenChange, triggerReason = "projects" }) {
  const reasons = {
    projects: { title: "Unlimited Projects", feature: "Create unlimited projects" },
    aiMastering: { title: "AI Mastering", feature: "AI-powered professional mastering" },
    collaboration: { title: "Collaboration", feature: "Invite collaborators and work together" },
    studio: { title: "NaliStudio", feature: "Full studio access" },
    coverart: { title: "AI Cover Art", feature: "Generate AI cover art" },
    analytics: { title: "Analytics", feature: "Detailed audience insights" },
  };

  const reason = reasons[triggerReason] || reasons.projects;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center font-heading text-xl">{reason.title} is Free</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground mt-2">
            All features are unlocked for everyone — no subscription required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
            <p className="text-sm font-semibold text-foreground">Included for free:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>✓ {reason.feature}</li>
              <li>✓ Unlimited projects</li>
              <li>✓ Team collaboration & permissions</li>
              <li>✓ Unlimited studio tracks</li>
              <li>✓ Advanced analytics</li>
            </ul>
          </div>

          <Button
            className="w-full rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white font-semibold"
            onClick={() => onOpenChange(false)}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}