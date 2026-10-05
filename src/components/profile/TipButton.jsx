import { useState } from "react";
import { Heart, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const PRESETS = [5, 10, 25, 50];

export default function TipButton({ creatorId, creatorName }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(5);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleTip = async () => {
    if (!isAuthenticated) {
      navigate(`/login?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    setLoading(true);
    try {
      const appUrl = window.location.origin;
      const response = await base44.functions.invoke("createTipCheckout", {
        creator_id: creatorId,
        creator_name: creatorName,
        amount,
        message: message.trim() || undefined,
        callbackUrls: {
          postFlowUrl: appUrl,
          thankYouPageUrl: `${appUrl}/ThankYou`,
        },
      });
      const checkoutUrl = response?.data?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (error) {
      toast.error("Failed to start tip. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="ui-hover min-h-11 w-full gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose-500/10 transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-rose-400/40 sm:w-auto"
      >
        <Heart className="w-4 h-4" />
        Tip {creatorName?.split(" ")[0] || "Creator"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-md rounded-3xl border-border/80 bg-card/95 p-5 backdrop-blur-xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500" />
              Tip {creatorName}
            </DialogTitle>
            <DialogDescription>
              Show your appreciation. {creatorName} receives your tip (minus a small platform fee).
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 py-2 sm:gap-3">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset)}
                className={`ui-hover relative min-h-14 rounded-xl border p-3 text-center text-lg font-bold transition-all sm:p-4 ${
                  amount === preset
                    ? "border-rose-500 bg-rose-500/10 text-rose-500"
                    : "border-border bg-card hover:border-rose-500/50"
                }`}
              >
                ${preset}
                {amount === preset && (
                  <Check className="absolute top-2 right-2 w-4 h-4 text-rose-500" />
                )}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Add a message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={500}
            className="min-h-20 resize-none"
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button className="ui-hover min-h-11 rounded-xl" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              onClick={handleTip}
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
                  Tip ${amount}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}