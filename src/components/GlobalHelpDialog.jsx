import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, HelpCircle } from "lucide-react";

export default function GlobalHelpDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>Help & Support</DialogTitle>
          </div>
          <DialogDescription>
            Need help? Here are a few ways to find what you're looking for.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="p-4 rounded-xl border border-border bg-secondary/30 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm mb-1">Ask Nali AI</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Our AI assistant can answer questions and help you navigate the studio. Just click the Sparkles button in the bottom right corner.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-secondary/30 flex items-start gap-3">
            <MessageCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm mb-1">Community Support</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Join the Network and ask other producers for tips, feedback, and support.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={() => onOpenChange(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">
            Got it
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}