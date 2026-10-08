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
    if (!ADS_ENABLED) return;
    const ins = insRef.current;
    if (!ins) return;

    // AdSense marks initialized <ins> elements with data-adsbygoogle-status="done".
    // Don't push again for an already-initialized slot.
    const isInitialized = () =>
      ins.getAttribute("data-adsbygoogle-status") === "done";

    const pushAd = () => {
      // Guard: component may have unmounted or AdSense may have already
      // initialized this slot by the time the script fires.
      if (!ins.isConnected || isInitialized()) return;
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch {
        // Library not ready — the script's auto-init will pick up the ins tag.
      }
    };

    // If the library is already loaded, push immediately. Otherwise wait for
    // the loader script to fire its load event so the push doesn't queue up
    // and outlive this component (the cause of the "no_div" console error).
    if (typeof window.adsbygoogle !== "undefined") {
      pushAd();
      return;
    }

    const loader = document.getElementById("adsbygoogle-loader");
    if (loader) {
      if (loader.readyState === "complete" || loader.dataset.loaded === "1") {
        pushAd();
      } else {
        const onLoad = () => {
          loader.dataset.loaded = "1";
          pushAd();
        };
        loader.addEventListener("load", onLoad, { once: true });
        return () => loader.removeEventListener("load", onLoad);
      }
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