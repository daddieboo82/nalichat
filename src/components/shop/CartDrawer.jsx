import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useCart } from "@/lib/CartContext";
import { Button } from "@/components/ui/button";
import { Trash2, ShoppingCart, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useState } from "react";
import { toast } from "sonner";

export default function CartDrawer() {
  const { items, removeFromCart, total, isOpen, setIsOpen, clearCart } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      if (typeof window !== 'undefined' && window.gtag) {
        const convParams = { send_to: 'AW-18416125487/OnfzCI7a5OkcEK-Mv81E' };
        if (total > 0) { convParams.value = total; convParams.currency = 'USD'; }
        window.gtag('event', 'conversion', convParams);
      }
      const checkoutItems = items.map(item => ({
        id: item.id,
        quantity: item.quantity || 1
      }));

      const res = await base44.functions.invoke("createCheckout", {
        items: checkoutItems,
        callbackUrls: {
          thankYouPageUrl: window.location.origin + "/ThankYou",
          postFlowUrl: window.location.href
        }
      });

      if (res.data && res.data.checkoutUrl && res.data.checkoutId) {
        try { localStorage.setItem(`gads_purchase_value:${res.data.checkoutId}`, String(total)); } catch {}
        window.top.location.href = res.data.checkoutUrl;
      } else {
        toast.error("Checkout failed. Please try again.");
      }
    } catch (error) {
      console.error("Checkout error:", error);
      const status = error?.response?.status || error?.status;
      if (status === 402) {
        toast.error("Checkout is temporarily unavailable. Please try again later or contact support.", { duration: 6000 });
      } else if (status === 400) {
        toast.error("Invalid checkout details. Please review your cart and try again.", { duration: 6000 });
      } else {
        toast.error("An error occurred during checkout. Please try again.", { duration: 6000 });
      }
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex w-full flex-col border-l border-border/50 bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:max-w-md sm:p-6">
        <SheetHeader className="mb-5 space-y-2 text-left sm:mb-6">
          <SheetTitle className="flex items-center gap-2 font-heading text-xl text-white">
            <ShoppingCart className="w-5 h-5" /> Your Cart
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Review your selected items before purchase.
          </SheetDescription>
        </SheetHeader>

        <div className="-mr-1 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1 sm:-mr-2 sm:space-y-4 sm:pr-2">
          {items.length === 0 ? (
            <div className="ui-surface flex h-full min-h-[260px] flex-col items-center justify-center rounded-3xl border border-dashed border-border text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              <p>Your cart is empty.</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="ui-surface flex flex-col gap-2 rounded-2xl border border-white/5 bg-secondary/30 p-3 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 items-center flex-1 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-5 h-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-white truncate">{item.title || item.name}</p>
                      <p className="text-xs text-white/50">{item.creator_name}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary">${item.price?.toFixed(2)}</p>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="ui-hover ml-auto mt-1 flex min-h-9 items-center justify-end gap-1 rounded-lg px-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="w-3 h-3" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-auto space-y-4 border-t border-white/10 pt-5 sm:pt-6">
            <div className="flex justify-between items-center text-lg font-bold text-white">
              <span>Total:</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
            <Button 
              className="ui-hover h-14 w-full rounded-xl bg-white text-base font-bold text-black shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-primary/40"
              onClick={handleCheckout}
              disabled={isCheckingOut}
            >
              {isCheckingOut ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <ShoppingCart className="w-5 h-5 mr-2" />}
              {isCheckingOut ? "Processing..." : "Checkout securely"}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}