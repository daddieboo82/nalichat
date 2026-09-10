import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useState } from "react";
import { toast } from "sonner";

const features = [
  "Unlimited Studio Tracks",
  "Unlimited File Sharing",
  "Advanced Analytics & Insights",
  "Audience Management Tools",
  "Collaboration Tools",
  "AI Mastering & Cover Art",
  "Priority Support",
];

export default function PricingPlans() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [startingCheckout, setStartingCheckout] = useState(false);

  const startCheckout = async () => {
    if (!isAuthenticated) {
      navigate("/register");
      return;
    }

    setStartingCheckout(true);
    try {
      const appUrl = window.location.origin;
      const response = await base44.functions.invoke("createSubscriptionCheckout", {
        plan: "pro",
        callbackUrls: {
          thankYouPageUrl: `${appUrl}/ThankYou`,
          postFlowUrl: window.location.href,
        },
      });
      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      throw new Error("No checkout URL returned");
    } catch (error) {
      console.error("Subscription checkout failed:", error);
      toast.error("Could not start subscription checkout. Please try again.");
      setStartingCheckout(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-heading font-black text-4xl mb-4">
            Full App Access
          </h2>
          <p className="text-lg text-muted-foreground">
            Get the full NaliChat experience for $19.99 every 30 days. Exports and stems are included with your app access.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          className="relative rounded-2xl border border-primary/60 bg-primary/5 shadow-xl shadow-primary/20"
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <span className="bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
              $19.99 / 30 DAYS
            </span>
          </div>

          <div className="p-8">
            <h3 className="font-heading font-bold text-2xl mb-2">
              NaliChat Access
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              One recurring plan unlocks the app across web, mobile, and desktop downloads. No separate export or stem charges.
            </p>

            <div className="mb-6">
              <span className="font-heading font-black text-4xl">$19.99</span>
              <span className="text-muted-foreground ml-2">every 30 days</span>
            </div>

            <Button
              onClick={startCheckout}
              disabled={startingCheckout}
              className="w-full rounded-xl mb-8 bg-primary hover:bg-primary/90"
            >
              {startingCheckout ? "Redirecting..." : isAuthenticated ? "Start Subscription" : "Sign Up to Subscribe"}
            </Button>

            <div className="space-y-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-primary/20 bg-background/60 p-4 text-left">
              <p className="text-sm font-semibold mb-2">Included with your plan</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Windows desktop download</li>
                <li>• macOS desktop download</li>
                <li>• Track exports</li>
                <li>• Stem access and downloads</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}