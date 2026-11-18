import { Music } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Status banners shown above the Studio toolbar: low-end performance notice,
 * view-only collaborator notice, and the Premium upgrade prompt.
 * Extracted from Studio.jsx to keep that file manageable.
 */
export default function StudioStatusBanners({
  isLowEnd,
  isViewOnly,
  showUpgradeBanner,
  onUpgradeClick,
}) {
  return (
    <>
      {isLowEnd && (
        <div className="studio-mobile-performance-banner absolute top-2 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-medium backdrop-blur-md whitespace-nowrap">
          ⚠ Performance Mode: Reduced waveform quality for smoother experience
        </div>
      )}

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