import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Music, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function ThankYou() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 0.8 }}
          className="mb-6 inline-block"
        >
          <CheckCircle className="w-20 h-20 text-accent" />
        </motion.div>

        <h1 className="font-heading font-black text-5xl mb-4">
          Welcome to the Community!
        </h1>

        <p className="text-xl text-muted-foreground mb-8">
          Your subscription is now active. You have full access to all premium features including unlimited studio projects, AI mastering, and priority messaging.
        </p>

        <div className="bg-card border border-primary/30 rounded-2xl p-8 mb-8">
          <h2 className="font-heading font-bold text-2xl mb-4 flex items-center justify-center gap-2">
            <Music className="w-6 h-6 text-primary" />
            What's Next?
          </h2>
          <ul className="text-left space-y-3 text-muted-foreground mb-6">
            <li>✓ Create your first project in the Studio</li>
            <li>✓ Upload your tracks and collaborate</li>
            <li>✓ Connect with other artists in Network</li>
            <li>✓ Use AI Mastering on your tracks</li>
          </ul>
        </div>

        <div className="flex gap-4 justify-center flex-wrap">
          <Link to="/studio">
            <Button size="lg" className="rounded-xl bg-primary hover:bg-primary/90">
              <Music className="w-5 h-5 mr-2" />
              Open Studio
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <Link to="/explore">
            <Button size="lg" variant="outline" className="rounded-xl">
              Explore Tracks
            </Button>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}