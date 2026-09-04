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
      const response = await base44.functions.invoke("createCheckout", {
        items: [{ name: "Donation to NaliChat", quantity: 1, price: amount.toFixed(2) }],
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
            ? "rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-90 text-base shimmer-hover px-7"
            : "rounded-2xl h-14 px-8 text-lg font-bold bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-90 transition-all hover:scale-105"
        }
      >
        <Heart className="w-5 h-5 mr-2" />
        Support NaliChat
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Support NaliChat
            </DialogTitle>
            <DialogDescription>
              Your donation helps keep NaliChat free for all creators. Choose an amount below.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 py-4">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`relative rounded-xl border p-4 text-center font-bold text-lg transition-all ${
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

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleDonate}
              disabled={loading}
              className="bg-gradient-to-r from-rose-500 to-pink-500 hover:opacity-90"
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