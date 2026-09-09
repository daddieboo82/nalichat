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
      // even if the Stripe webhook hasn't fired yet.
      if (checkoutId) {
        try {
          await base44.functions.invoke('verifyCheckoutPayment', { checkoutId });
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
          // Standard cart purchase flow
          await new Promise(resolve => setTimeout(resolve, 1000));
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
            : "Your purchase is complete. Your items are now available."}
        </p>

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