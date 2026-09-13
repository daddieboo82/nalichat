import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageCircle, HelpCircle, ArrowRight, Mic2, FolderOpen } from "lucide-react";

export default function GlobalHelpDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto overscroll-contain rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 ring-1 ring-primary/20">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <DialogTitle>Help & Support</DialogTitle>
          </div>
          <DialogDescription>Get unstuck quickly with Nali, the community, or a direct shortcut to the tools you need.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="ui-surface flex items-start gap-3 rounded-3xl border border-border bg-secondary/30 p-4 sm:p-5">
            <Sparkles className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm mb-1">Ask Nali AI</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Our AI assistant can answer questions and help you navigate the studio. Just click the Sparkles button in the bottom right corner.
              </p>
            </div>
          </div>

          <div className="ui-surface flex items-start gap-3 rounded-3xl border border-border bg-secondary/30 p-4 sm:p-5">
            <MessageCircle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm mb-1">Community Support</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Join the Network and ask other producers for tips, feedback, and support.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="ui-hover min-h-12 justify-between rounded-xl px-4"><a href="/studio"><span className="flex items-center gap-2"><Mic2 className="h-4 w-4 text-primary" />Open Studio</span><ArrowRight className="h-4 w-4" /></a></Button>
            <Button asChild variant="outline" className="ui-hover min-h-12 justify-between rounded-xl px-4"><a href="/files"><span className="flex items-center gap-2"><FolderOpen className="h-4 w-4 text-primary" />Open Files</span><ArrowRight className="h-4 w-4" /></a></Button>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
          <Button className="ui-hover min-h-11 rounded-xl" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}