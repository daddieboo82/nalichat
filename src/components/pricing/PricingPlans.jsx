import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

const plans = [
  {
    id: "trial",
    name: "24-Hour Trial",
    price: "0.99",
    period: "/24h",
    description: "Full access for 24 hours",
    features: [
      "24 Hours Full Studio Access",
      "Unlimited Tracks",
      "All Pro Features",
    ],
    cta: "Start Trial",
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "24.95",
    period: "/month",
    description: "Full access to all app features",
    features: [
      "Unlimited Studio Tracks",
      "Unlimited File Sharing",
      "Advanced Analytics & Insights",
      "Audience Management Tools",
      "Priority Support",
      "Collaboration Tools",
    ],
    cta: "Subscribe Now",
    popular: true,
  },
];

export default function PricingPlans() {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  
  const handleSubscribe = async (plan) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    setLoading(true);
    try {
      const response = await base44.functions.invoke("createSubscriptionCheckout", {
        plan: plan.id,
      });

      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <section className="py-16 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-12">
        <h2 className="font-heading font-black text-4xl mb-4">
          Unlock Full Access
        </h2>
        <p className="text-lg text-muted-foreground">
          Your free hour has expired or you don't have an active subscription.
          Upgrade now to continue creating!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8">
        {plans.map((plan, idx) => (
          <motion.div
            key={plan.name}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: idx * 0.1 }}
            viewport={{ once: true }}
            className={`relative rounded-2xl border transition-all ${
              plan.popular
                ? "border-primary/60 bg-primary/5 shadow-xl shadow-primary/20 scale-105"
                : "border-border bg-card hover:border-primary/30"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-white text-xs font-bold px-4 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
            )}

            <div className="p-8">
              <h3 className="font-heading font-bold text-2xl mb-2">
                {plan.name}
              </h3>
              <p className="text-muted-foreground text-sm mb-6">
                {plan.description}
              </p>

              <div className="mb-6">
                <span className="font-heading font-black text-4xl">
                  ${plan.price}
                </span>
                {plan.period && (
                  <span className="text-muted-foreground ml-2">{plan.period}</span>
                )}
              </div>

              <Button
                onClick={() => handleSubscribe(plan)}
                disabled={loading}
                className={`w-full rounded-xl mb-8 ${
                  plan.popular
                    ? "bg-primary hover:bg-primary/90"
                    : "bg-secondary hover:bg-secondary/80"
                }`}
              >
                {loading ? "Processing..." : plan.cta}
              </Button>

              <div className="space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      </section>
    </div>
  );
}