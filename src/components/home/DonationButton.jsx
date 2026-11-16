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
    if (loading || !PRESETS.includes(amount)) return;
    setLoading(true);
    try {
      // Only the canonical HTTPS origin is allowlisted by the checkout backend.
      // Do not use the visitor's current host (Base44 previews may differ).
      const appUrl = "https://nalichat.org";
      const response = await base44.functions.invoke("createCheckout", {
        items: [{ type: "donation", amount, quantity: 1 }],
        callbackUrls: {
          postFlowUrl: appUrl,
          thankYouPageUrl: appUrl + "/ThankYou",
        },
      });
      const payload = response?.data ?? response;
      if (payload?.error) throw new Error(payload.error);
      const checkoutId = payload?.checkoutId;
      const checkoutUrl = payload?.checkoutUrl;
      if (typeof checkoutId !== "string" || !/^cs_(?:test_|live_)?[A-Za-z0-9_]{8,255}$/.test(checkoutId)) {
        throw new Error("Donation checkout was not confirmed");
      }
      let destination;
      try { destination = new URL(checkoutUrl); } catch {
        throw new Error("Donation checkout URL is invalid");
      }
      if (destination.protocol !== "https:" ||
          !["checkout.stripe.com", "checkout.stripe.dev"].includes(destination.hostname)) {
        throw new Error("Donation checkout URL was not trusted");
      }
      // No conversion is recorded before an authenticated paid confirmation.
      try { localStorage.setItem(`gads_purchase_value:${checkoutId}`, String(amount)); } catch {}
      window.location.assign(destination.toString());
    } catch (error) {
      const message = error?.response?.data?.error || error?.data?.error || error?.message;
      toast.error(typeof message === "string" && /callback|checkout|payment|donation|rate limit|too many/i.test(message)
        ? message : "Unable to open secure donation checkout. Please try again.");
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
        Support NaliBase
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Support NaliBase
            </DialogTitle>
            <DialogDescription>
              Your donation helps keep NaliBase free for all creators. Choose an amount below.
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