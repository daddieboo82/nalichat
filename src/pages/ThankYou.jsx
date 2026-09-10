import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Music, ArrowRight, Loader2, Download, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useCart } from "@/lib/CartContext";

export default function ThankYou() {
  const queryClient = useQueryClient();
  const { clearCart } = useCart();
  const [processing, setProcessing] = useState(true);
  const [exportState, setExportState] = useState(null); // null | downloading | done | error
  const [exportInfo, setExportInfo] = useState(null);
  // Purchased licensed tracks resolved from verifyCheckoutPayment's item list —
  // the standard cart flow used to confirm payment and then discard this data,
  // so a buyer got a generic "your items are now available" message with no
  // actual delivery of what they paid for.
  const [purchasedTracks, setPurchasedTracks] = useState([]);
  const [hadDonationOnly, setHadDonationOnly] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const isExport = urlParams.get("export") === "download";
  const isApk = urlParams.get("apk") === "1";
  const checkoutId = urlParams.get("checkout_id");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const processThankYou = async () => {
      // Fire Google Ads PURCHASE conversion once (value stashed before checkout redirect).
      try {
        const pendingPurchaseValue = parseFloat(localStorage.getItem('gads_purchase_value') || '0');
        if (pendingPurchaseValue > 0 && typeof window !== 'undefined' && window.gtag) {
          localStorage.removeItem('gads_purchase_value');
          window.gtag('event', 'conversion', {
            send_to: 'AW-18416125487/4WavCNzZ5ekcEK-Mv81E',
            value: pendingPurchaseValue,
            currency: 'USD',
          });
        } else {
          localStorage.removeItem('gads_purchase_value');
        }
      } catch (e) {}

      // Verify payment via backend fallback — ensures the purchase is fulfilled
      // even if the Stripe webhook hasn't fired yet. The response's `items`
      // list is what the buyer actually paid for; resolve any stem/track
      // licenses so we can hand over a real download instead of a vague
      // "your items are now available" message.
      let purchasedItems = [];
      if (checkoutId) {
        try {
          const res = await base44.functions.invoke('verifyCheckoutPayment', { checkoutId });
          purchasedItems = res?.data?.items || [];
        } catch (err) {
          console.error("Payment verification failed:", err);
        }
      }

      try {
        if (isApk) {
          // APK purchase — mark paid so the Download page reveals the link
          try { sessionStorage.setItem('apk_paid', '1'); } catch {}
          setExportState("done");
          setExportInfo({ fileName: "NaliChat.apk" });
          setProcessing(false);
        } else if (isExport) {
          // Studio export download flow — deliver the rendered file
          setExportState("downloading");
          const pending = localStorage.getItem("pending_studio_export");
          if (!pending) {
            setExportState("error");
            setProcessing(false);
            return;
          }

          const { fileUri, fileName } = JSON.parse(pending);
          try {
            const signedRes = await base44.functions.invoke('get-studio-export-url', { fileUri });
            const signedUrl = signedRes.data.signed_url;

            // Trigger the download
            const a = document.createElement("a");
            a.href = signedUrl;
            a.download = fileName || "NaliStudio Mix.wav";
            document.body.appendChild(a);
            a.click();
            a.remove();

            // Clean up the pending marker
            localStorage.removeItem("pending_studio_export");
            setExportInfo({ fileName });
            setExportState("done");
          } catch (err) {
            console.error("Export delivery error:", err);
            setExportState("error");
          }
          setProcessing(false);
        } else {
          // Standard cart purchase flow — resolve any purchased track/stem
          // licenses to real ArtPost records so we can deliver a download,
          // instead of silently discarding what was actually bought.
          const licenseItems = purchasedItems.filter((it) => it.type === "stem_license" && it.id);
          if (licenseItems.length > 0) {
            const resolved = await Promise.all(
              licenseItems.map(async (it) => {
                try {
                  const track = await base44.entities.ArtPost.get(it.id);
                  return track ? { id: it.id, title: track.title, file_url: track.file_url } : null;
                } catch (err) {
                  console.error("Failed to resolve purchased track", it.id, err);
                  return null;
                }
              })
            );
            setPurchasedTracks(resolved.filter(Boolean));
          } else if (purchasedItems.some((it) => it.type === "donation")) {
            setHadDonationOnly(true);
          }
          await queryClient.invalidateQueries({ queryKey: ["subscription"] });
          clearCart();
          setProcessing(false);
        }
      } catch (error) {
        console.error("Error processing thank you:", error);
        setProcessing(false);
      }
    };

    processThankYou();
  }, [queryClient, isExport, clearCart, checkoutId]);

  // ── APK purchase view ──
  if (isApk) {
    const APK_DOWNLOAD_URL = 'https://github.com/daddieboo82/nalichat/releases/latest/download/NaliChat.apk';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl"
        >
          <motion.div
            className="mb-6 inline-block"
          >
            {processing ? (
              <Loader2 className="w-20 h-20 text-primary animate-spin" />
            ) : (
              <CheckCircle className="w-20 h-20 text-accent" />
            )}
          </motion.div>

          <h1 className="font-heading font-black text-5xl mb-4">
            {processing ? "Confirming Purchase..." : "Thank You!"}
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            {processing
              ? "Confirming your payment. This takes just a moment..."
              : "Your purchase is complete. Download the NaliChat app below."}
          </p>

          {!processing && (
            <a href={APK_DOWNLOAD_URL} download="NaliChat.apk">
              <Button size="lg" className="rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 h-14 px-8 text-lg font-bold">
                <Download className="w-5 h-5 mr-2" />
                Download APK
              </Button>
            </a>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Export download view ──
  if (isExport) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl"
        >
          <motion.div
            animate={{ rotate: exportState === "downloading" ? 360 : 0 }}
            transition={{ duration: exportState === "downloading" ? 2 : 0.8 }}
            className="mb-6 inline-block"
          >
            {exportState === "downloading" && <Loader2 className="w-20 h-20 text-primary animate-spin" />}
            {exportState === "done" && <CheckCircle className="w-20 h-20 text-accent" />}
            {exportState === "error" && <AlertCircle className="w-20 h-20 text-destructive" />}
          </motion.div>

          <h1 className="font-heading font-black text-5xl mb-4">
            {exportState === "downloading" && "Preparing Your Download…"}
            {exportState === "done" && "Export Ready!"}
            {exportState === "error" && "Download Unavailable"}
          </h1>

          <p className="text-xl text-muted-foreground mb-8">
            {exportState === "downloading" && "Your payment was confirmed. Your file is being prepared for download."}
            {exportState === "done" && `Your ${exportInfo?.fileName || "mix"} has been downloaded. Check your downloads folder!`}
            {exportState === "error" && "We couldn't deliver your file. This may be because the session expired. Please try exporting again from the Studio."}
          </p>

          {exportState === "done" && (
            <div className="flex gap-4 justify-center flex-wrap">
              <Link to="/studio">
                <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90">
                  <Music className="w-5 h-5 mr-2" />
                  Back to Studio
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="rounded-xl">
                  Explore Tracks
                </Button>
              </Link>
            </div>
          )}

          {exportState === "error" && (
            <Link to="/studio">
              <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90">
                <Music className="w-5 h-5 mr-2" />
                Back to Studio
              </Button>
            </Link>
          )}
        </motion.div>
      </div>
    );
  }

  // ── Standard cart purchase view ──
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        <motion.div
          animate={{ rotate: processing ? 360 : 0 }}
          transition={{ duration: processing ? 2 : 0.8 }}
          className="mb-6 inline-block"
        >
          {processing ? (
            <Loader2 className="w-20 h-20 text-primary animate-spin" />
          ) : (
            <CheckCircle className="w-20 h-20 text-accent" />
          )}
        </motion.div>

        <h1 className="font-heading font-black text-5xl mb-4">
          {processing ? "Confirming Purchase..." : "Purchase Complete!"}
        </h1>

        <p className="text-xl text-muted-foreground mb-8">
          {processing
            ? "Confirming your payment. This takes just a moment..."
            : purchasedTracks.length > 0
              ? "Your license purchase is confirmed. Download your track below."
              : hadDonationOnly
                ? "Thank you for supporting NaliChat — your donation keeps the app free for everyone."
                : "Your purchase is complete. Your items are now available."}
        </p>

        {!processing && purchasedTracks.length > 0 && (
          <div className="bg-card border border-primary/30 rounded-2xl p-6 mb-8 text-left space-y-3">
            {purchasedTracks.map((track) => (
              <div key={track.id} className="flex items-center justify-between gap-4 bg-secondary/30 rounded-xl p-4">
                <div className="min-w-0">
                  <p className="font-semibold truncate">{track.title || "Purchased track"}</p>
                  <p className="text-xs text-muted-foreground">License purchased</p>
                </div>
                {track.file_url ? (
                  <a href={track.file_url} download className="shrink-0">
                    <Button size="sm" className="rounded-xl bg-primary hover:bg-primary/90 gap-2">
                      <Download className="w-4 h-4" /> Download
                    </Button>
                  </a>
                ) : (
                  <span className="text-xs text-muted-foreground shrink-0">File unavailable</span>
                )}
              </div>
            ))}
          </div>
        )}

        {!processing && purchasedTracks.length === 0 && (
          <div className="bg-card border border-primary/30 rounded-2xl p-8 mb-8">
            <h2 className="font-heading font-bold text-2xl mb-4 flex items-center justify-center gap-2">
              <Music className="w-6 h-6 text-primary" />
              What's Next?
            </h2>
            <ul className="text-left space-y-3 text-muted-foreground mb-6">
              <li>✓ Create your first project in the Studio</li>
              <li>✓ Upload your tracks and collaborate</li>
              <li>✓ Connect with other artists in Network</li>
              <li>✓ Use AI Mastering on your tracks</li>
            </ul>
          </div>
        )}

        {!processing && (
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/studio">
              <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90">
                <Music className="w-5 h-5 mr-2" />
                Open Studio
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/explore">
              <Button size="lg" variant="outline" className="rounded-xl">
                Explore Tracks
              </Button>
            </Link>
          </div>
        )}
      </motion.div>
    </div>
  );
}