import { useEffect, useRef, useState } from "react";
import { Heart, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const PRESETS = [5, 10, 25, 50];

// The homepage can render multiple Support buttons. Share an in-flight
// confirmation so the same PayPal order is never captured twice in parallel.
const pendingCaptureRequests = new Map();
function verifyExistingDonation(orderId, verifier) {
  const key = orderId + ":" + verifier;
  if (pendingCaptureRequests.has(key)) return pendingCaptureRequests.get(key);
  const promise = Promise.resolve()
    .then(() => base44.functions.invoke("capturePayPalDonation", { orderId, verifier }))
    .finally(() => pendingCaptureRequests.delete(key));
  pendingCaptureRequests.set(key, promise);
  return promise;
}

export default function DonationButton({ variant = "hero" }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [loading, setLoading] = useState(false);
  const handledReturn = useRef(false);
  const [donationPending, setDonationPending] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);

  useEffect(() => {
    if (handledReturn.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paypal_donation_cancel") === "1") {
      handledReturn.current = true;
      toast.info("PayPal donation canceled. No donation was charged by NaliChat.");
      params.delete("paypal_donation_cancel");
      window.history.replaceState(window.history.state, "", window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash);
      return;
    }
    if (params.get("paypal_donation") !== "1") return;
    const orderId = params.get("token");
    const verifier = params.get("donation_verifier");
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(orderId || "") || !/^[0-9a-f]{64}$/.test(verifier || "")) {
      handledReturn.current = true;
      toast.error("PayPal donation verification information is incomplete. Contact support before donating again.");
      return;
    }
    handledReturn.current = true;
    setPendingOrder({ orderId, verifier });
    setDonationPending(true);
    verifyExistingDonation(orderId, verifier).then(res => {
      const data = res?.data ?? res;
      if (data?.success === true && data?.action === "capture_paypal_donation" && data?.status === "paid") {
        setPendingOrder(null);
        toast.success("Thank you! PayPal has confirmed your donation.");
        params.delete("paypal_donation");
        params.delete("donation_verifier");
        params.delete("token");
        params.delete("PayerID");
        window.history.replaceState(window.history.state, "", window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash);
      } else {
        toast.info("Your PayPal donation is not confirmed yet. Use Check payment again; do not pay twice.");
      }
    }).catch(() => toast.error("Unable to confirm your PayPal donation. Use Check payment again; do not pay twice.")).finally(() => setDonationPending(false));
  }, []);

  const handleDonate = async () => {
    if (loading || donationPending || pendingOrder || !PRESETS.includes(amount)) return;
    setLoading(true);
    try {
      const response = await base44.functions.invoke("createPayPalDonation", { amount });
      const data = response?.data ?? response;
      if (data?.error) throw new Error(data.error);
      if (data?.success !== true || data?.action !== "create_paypal_donation" ||
          !/^[A-Za-z0-9_-]{8,64}$/.test(data?.orderId || "")) {
        throw new Error("PayPal donation checkout was not confirmed");
      }
      let url;
      try { url = new URL(data.checkoutUrl); } catch {
        throw new Error("Invalid PayPal approval address");
      }
      const trustedHost = ["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname);
      if (url.protocol !== "https:" || !trustedHost) throw new Error("Untrusted PayPal approval address");
      window.location.assign(url.toString());
    } catch (error) {
      const message = error?.response?.data?.error || error?.data?.error || error?.message;
      toast.error(typeof message === "string" && /paypal|donation|checkout|attempt/i.test(message)
        ? message : "PayPal donation checkout is unavailable. Please try again later.");
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => { if (pendingOrder) return; setOpen(true); }}
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

      {pendingOrder && (
        <div role="status" className="mt-3 rounded-xl border border-amber-500/30 bg-card p-3 text-sm">
          <p className="font-semibold">PayPal donation awaiting confirmation</p>
          <p className="mt-1 text-muted-foreground">Do not start another donation. Check the existing PayPal order instead.</p>
          <Button type="button" size="sm" variant="outline" className="mt-2" disabled={donationPending} onClick={async () => {
            setDonationPending(true);
            try {
              const res = await verifyExistingDonation(pendingOrder.orderId, pendingOrder.verifier);
              const data = res?.data ?? res;
              if (data?.success === true && data?.action === "capture_paypal_donation" && data?.status === "paid") {
                setPendingOrder(null);
                const params = new URLSearchParams(window.location.search);
                for (const key of ["paypal_donation", "donation_verifier", "token", "PayerID"]) params.delete(key);
                window.history.replaceState(window.history.state, "", window.location.pathname + (params.toString() ? "?" + params.toString() : "") + window.location.hash);
                toast.success("PayPal has confirmed your donation. Thank you!");
              } else {
                toast.info("PayPal has not confirmed the donation yet. Check again later; do not pay twice.");
              }
            } catch {
              toast.error("Payment verification is temporarily unavailable. Do not start another donation.");
            } finally {
              setDonationPending(false);
            }
          }}>{donationPending ? "Checking PayPal..." : "Check payment again"}</Button>
        </div>
      )}
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
            <Button className="ui-hover min-h-11 rounded-xl" variant="outline" onClick={() => setOpen(false)} disabled={loading || donationPending}>
              Cancel
            </Button>
            <Button
              onClick={handleDonate}
              disabled={loading || donationPending || !!pendingOrder}
              className="ui-hover min-h-11 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 font-semibold hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening PayPal...
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