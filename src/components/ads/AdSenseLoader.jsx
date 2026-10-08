import { useEffect } from "react";
import { ADSENSE_CLIENT_ID, ADS_ENABLED } from "@/lib/adsConfig";
import { useSubscription } from "@/hooks/useSubscription";

let scriptInjected = false;

/**
 * Injects the AdSense library script once on mount.
 * Renders nothing — it's a headless initializer.
 * No script is injected until ADSENSE_CLIENT_ID is set in adsConfig.js.
 * Paying subscribers never load the AdSense library at all.
 */
export default function AdSenseLoader() {
  const { hasPaidAccess, isLoading } = useSubscription();
  useEffect(() => {
    if (!ADS_ENABLED || hasPaidAccess || isLoading || scriptInjected || typeof window === "undefined") return;
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