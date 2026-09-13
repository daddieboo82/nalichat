import { useState } from "react";
import { Heart, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const PRESETS = [5, 10, 25, 50];

export default function DonationButton({ variant = "hero" }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);

  const handleDonate = async () => {
    setLoading(true);
    try {
      const appUrl = window.location.origin;
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'conversion', {
          send_to: 'AW-18416125487/OnfzCI7a5OkcEK-Mv81E',
          value: amount,
          currency: 'USD',
        });
      }
      try { localStorage.setItem('gads_purchase_value', String(amount)); } catch {}
      const response = await base44.functions.invoke("createCheckout", {
        items: [{ type: "donation", amount: amount, quantity: 1 }],
        callbackUrls: {
          postFlowUrl: appUrl,
          thankYouPageUrl: `${appUrl}/ThankYou`,
        },
      });
      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      toast.error("Failed to start donation. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className={
          variant === "hero"
            ? "ui-hover min-h-12 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-7 text-base font-semibold shimmer-hover hover:opacity-90"
            : "ui-hover h-14 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 px-8 text-lg font-bold transition-all hover:opacity-90"
        }
      >
        <Heart className="w-5 h-5 mr-2" />
        Support NaliChat
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Support NaliChat
            </DialogTitle>
            <DialogDescription>
              Your donation helps keep NaliChat free for all creators. Choose an amount below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-4 sm:gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`ui-hover relative min-h-14 rounded-xl border p-3 text-center text-lg font-bold transition-all sm:p-4 ${
                  amount === preset
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card hover:border-primary/50"
                }`}
              >
                ${preset}
                {amount === preset && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button className="ui-hover min-h-11 rounded-xl" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleDonate}
              disabled={loading}
              className="ui-hover min-h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 font-semibold hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4 mr-2" />
                  Donate ${amount}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}