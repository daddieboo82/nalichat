import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { ADSENSE_CLIENT_ID, ADS_ENABLED } from "@/lib/adsConfig";

/**
 * A single AdSense ad unit wrapped in a container that blends with the
 * dark neon theme. Renders nothing at all when AdSense isn't configured —
 * the page stays exactly as beautiful as it is now.
 *
 * Props:
 *   slot    — AdSense ad-unit slot ID (from your AdSense dashboard)
 *   format  — "auto" (responsive), "fluid", "horizontal", etc.
 *   label   — small "Sponsored" caption text
 *   className — extra classes on the outer container
 */
export default function AdSlot({
  slot = "",
  format = "auto",
  label = "Sponsored",
  className,
}) {
  const insRef = useRef(null);

  useEffect(() => {
    if (!ADS_ENABLED || !insRef.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense library not loaded yet — it'll pick up the ins tag
      // automatically once the script finishes loading.
    }
  }, []);

  if (!ADS_ENABLED) return null;

  return (
    <div
      className={cn(
        "ui-surface overflow-hidden rounded-2xl border border-border/40",
        className
      )}
    >
      <span className="block px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
        {label}
      </span>
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: "block", minHeight: "90px" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}