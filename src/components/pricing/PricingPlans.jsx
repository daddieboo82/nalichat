import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

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

  return (
    <div className="h-full overflow-y-auto bg-background">
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-heading font-black text-4xl mb-4">
            Everything is Free
          </h2>
          <p className="text-lg text-muted-foreground">
            All features are unlocked for everyone. NaliChat is 100% free — we monetize through per-item sales, not subscriptions.
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
              100% FREE
            </span>
          </div>

          <div className="p-8">
            <h3 className="font-heading font-bold text-2xl mb-2">
              NaliChat Free
            </h3>
            <p className="text-muted-foreground text-sm mb-6">
              Full access to every feature — no credit card, no trial, no limits.
            </p>

            <div className="mb-6">
              <span className="font-heading font-black text-4xl">$0</span>
              <span className="text-muted-foreground ml-2">forever</span>
            </div>

            <Button
              onClick={() => navigate("/studio")}
              className="w-full rounded-xl mb-8 bg-primary hover:bg-primary/90"
            >
              Start Creating
            </Button>

            <div className="space-y-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}