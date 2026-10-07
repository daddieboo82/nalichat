import { useEffect } from "react";
import { ADSENSE_CLIENT_ID, ADS_ENABLED } from "@/lib/adsConfig";

let scriptInjected = false;

/**
 * Injects the AdSense library script once on mount.
 * Renders nothing — it's a headless initializer.
 * No script is injected until ADSENSE_CLIENT_ID is set in adsConfig.js.
 */
export default function AdSenseLoader() {
  useEffect(() => {
    if (!ADS_ENABLED || scriptInjected || typeof window === "undefined") return;
    scriptInjected = true;

    const script = document.createElement("script");
    script.id = "adsbygoogle-loader";
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
    script.crossOrigin = "anonymous";
    document.head.appendChild(script);
  }, []);

  return null;
}