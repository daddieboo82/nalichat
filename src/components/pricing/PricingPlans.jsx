import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Free",
    price: "0",
    description: "Get started creating",
    features: [
      "1 Project",
      "Basic Studio Tools",
      "5 Messages/Day",
      "Community Access",
    ],
    cta: "Start Free",
    popular: false,
  },
  {
    name: "Artist Pro",
    price: "9.99",
    period: "/month",
    description: "For serious creators",
    features: [
      "Unlimited Projects",
      "Advanced Studio Tools",
      "Unlimited Messages",
      "AI Mastering (5/month)",
      "Analytics Dashboard",
      "Priority Support",
    ],
    cta: "Subscribe Now",
    popular: true,
    subscriptionInfo: {
      subscriptionSettings: {
        frequency: "MONTH",
      },
      title: "Artist Pro - Monthly",
      description: "Unlimited studio projects and messaging for artists",
    },
  },
  {
    name: "Studio Elite",
    price: "24.99",
    period: "/month",
    description: "For studios & labels",
    features: [
      "Everything in Pro",
      "Unlimited AI Mastering",
      "Team Collaborators (5)",
      "Custom Branding",
      "Advanced Analytics",
      "API Access",
      "Dedicated Support",
    ],
    cta: "Subscribe Now",
    popular: false,
    subscriptionInfo: {
      subscriptionSettings: {
        frequency: "MONTH",
      },
      title: "Studio Elite - Monthly",
      description: "Full suite for professional studios and labels",
    },
  },
];

export default function PricingPlans() {
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (plan) => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const items = [
        {
          name: plan.name,
          quantity: 1,
          price: plan.price,
          subscriptionInfo: plan.subscriptionInfo,
        },
      ];

      const response = await base44.functions.invoke("createCheckout", {
        items,
        callbackUrls: {
          thankYouPageUrl: `${origin}/thank-you`,
          postFlowUrl: `${origin}/`,
        },
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
    <section className="py-16 px-6 max-w-7xl mx-auto">
      <div className="text-center mb-12">
        <h2 className="font-heading font-black text-4xl mb-4">
          Simple, Transparent Pricing
        </h2>
        <p className="text-lg text-muted-foreground">
          Choose the plan that fits your creative journey
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                disabled={loading || plan.name === "Free"}
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
  );
}