import { motion } from "framer-motion";
import { Zap, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export default function StudioNew() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-secondary/20 via-background to-secondary/10">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md text-center space-y-6"
      >
        {/* Icon */}
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto shadow-2xl shadow-primary/30"
        >
          <Wrench className="w-12 h-12 text-white" />
        </motion.div>

        {/* Content */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground mb-3">
            Studio Under Construction
          </h1>
          <p className="text-muted-foreground text-base">
            We're rebuilding the studio with improved features. Check back soon!
          </p>
        </div>

        {/* Features Coming */}
        <div className="space-y-2 text-left bg-secondary/30 border border-border/50 rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Coming Soon
          </p>
          <ul className="space-y-2">
            {[
              "Multi-track recording & mixing",
              "Real-time collaboration",
              "AI-powered mastering",
              "Professional effects & plugins"
            ].map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-foreground/80">
                <Zap className="w-3 h-3 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Back Button */}
        <Link to="/">
          <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg">
            Back to Home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}