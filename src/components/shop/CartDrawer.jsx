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
      const checkoutItems = items.map(item => ({
        name: item.title || item.name || "Unknown Item",
        price: item.price || 0,
        quantity: item.quantity || 1
      }));

      const res = await base44.functions.invoke("createCheckout", {
        items: checkoutItems,
        callbackUrls: {
          thankYouPageUrl: window.location.origin + "/ThankYou",
          postFlowUrl: window.location.origin + "/"
        }
      });

      if (res.data && res.data.checkoutUrl) {
        window.top.location.href = res.data.checkoutUrl;
      } else {
        toast.error("Checkout failed. Please try again.");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred during checkout.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md bg-card/95 backdrop-blur-xl border-l border-border/50 flex flex-col p-6">
        <SheetHeader className="text-left space-y-2 mb-6">
          <SheetTitle className="flex items-center gap-2 font-heading text-xl text-white">
            <ShoppingCart className="w-5 h-5" /> Your Cart
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Review your selected items before purchase.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 -mr-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              <p>Your cart is empty.</p>
            </div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex flex-col gap-2 bg-secondary/30 p-3 rounded-xl border border-white/5 shadow-sm">
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
                      className="text-xs text-red-400 hover:text-red-300 hover:underline mt-1 flex items-center justify-end gap-1 ml-auto transition-colors"
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
          <div className="pt-6 border-t border-white/10 mt-auto space-y-4">
            <div className="flex justify-between items-center text-lg font-bold text-white">
              <span>Total:</span>
              <span className="text-primary">${total.toFixed(2)}</span>
            </div>
            <Button 
              className="w-full h-14 text-base font-bold bg-white text-black hover:bg-white/90 shadow-[0_0_20px_rgba(255,255,255,0.15)] rounded-xl transition-all"
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