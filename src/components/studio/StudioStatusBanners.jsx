import { Gauge, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StudioPerformanceNotice() {
  return (
    <div className="relative mx-2 mt-1.5 flex min-w-0 shrink-0 items-start gap-2 self-start rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-1 text-xs text-foreground sm:mx-3" role="status">
      <Gauge className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden="true" />
      <p>
        <span className="font-semibold">Performance Mode</span>
        {" · "}
        <span className="text-muted-foreground">Simplified waveforms</span>
      </p>
    </div>
  );
}
export default function StudioStatusBanners({
  isViewOnly,
  showUpgradeBanner,
  onUpgradeClick,
}) {
  return (
    <>
      {isViewOnly && (
        <div
          role="status"
          className="mx-2 sm:mx-3 mt-2 rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 flex items-center gap-2 relative z-20 text-blue-200"
        >
          <Music className="w-4 h-4 shrink-0" aria-hidden="true" />
          <p className="text-xs sm:text-sm font-medium">
            View-only access. This shared project belongs to someone else, so your edits can't be saved. Ask the owner for editor access to change it.
          </p>
        </div>
      )}

      {showUpgradeBanner && (
        <div className="studio-mobile-upgrade-banner mx-2 sm:mx-3 mt-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 flex items-center justify-between gap-3 relative z-20">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-semibold text-foreground">Take this session further with Premium</p>
            <p className="hidden sm:block text-xs text-muted-foreground">Unlock more NALI.ai, advanced Studio tools, and the complete creator workflow.</p>
          </div>
          <Button size="sm" className="shrink-0" onClick={onUpgradeClick}>
            Unlock Premium
          </Button>
        </div>
      )}
    </>
  );
}