import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Music, Users, PlaySquare, ArrowRight, CheckCircle2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function InteractiveWizard({ open, onOpenChange }) {
  const [step, setStep] = useState(1);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      onOpenChange(false);
      setStep(1); // Reset for next time
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border border-border bg-card p-0 overflow-hidden shadow-2xl rounded-3xl [&>button]:hidden">
        <button 
          onClick={() => onOpenChange(false)} 
          className="absolute right-4 top-4 rounded-full p-2 bg-background/50 hover:bg-background text-muted-foreground transition-colors z-50 focus:outline-none"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="min-h-[400px] flex flex-col">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 text-center flex-1 flex flex-col justify-center"
              >
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 shadow-inner shadow-primary/20 border border-primary/20">
                  <Music className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-2xl font-black font-heading mb-4 text-gradient-animate tracking-tight">Step 1: The Studio</h2>
                <p className="text-muted-foreground mb-8 text-base leading-relaxed">
                  NaliStudio inside the CREATE world features a fully-fledged browser DAW. You can record audio, add multiple tracks,
                  apply effects, and edit waveforms right from your browser.
                </p>
                <Button className="w-full h-12 text-lg rounded-xl bg-primary hover:opacity-90 mt-auto" onClick={handleNext}>
                  Continue <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 text-center flex-1 flex flex-col justify-center"
              >
                <div className="w-20 h-20 rounded-full bg-accent/20 flex items-center justify-center mx-auto mb-6 shadow-inner shadow-accent/20 border border-accent/20">
                  <Users className="w-10 h-10 text-accent" />
                </div>
                <h2 className="text-2xl font-black font-heading mb-4 text-gradient-animate tracking-tight">Step 2: Collaboration</h2>
                <p className="text-muted-foreground mb-8 text-base leading-relaxed">
                  Music is better together. Invite friends to your Studio session to see their live presence,
                  or use the Messages tab to securely chat and share files.
                </p>
                <Button className="w-full h-12 text-lg rounded-xl bg-accent hover:opacity-90 text-black mt-auto" onClick={handleNext}>
                  Next <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="p-10 text-center flex-1 flex flex-col justify-center"
              >
                <div className="w-20 h-20 rounded-full bg-pink-500/20 flex items-center justify-center mx-auto mb-6 shadow-inner shadow-pink-500/20 border border-pink-500/20">
                  <PlaySquare className="w-10 h-10 text-pink-500" />
                </div>
                <h2 className="text-2xl font-black font-heading mb-4 text-gradient-animate tracking-tight">Step 3: Publish</h2>
                <p className="text-muted-foreground mb-8 text-base leading-relaxed">
                  Once your masterpiece is ready, export the mix and publish it directly to your creator profile.
                  Fans can listen, like, and comment!
                </p>
                <Button className="w-full h-12 text-lg rounded-xl bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 mt-auto" onClick={handleNext}>
                  Get Started <CheckCircle2 className="w-5 h-5 ml-2" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2 pb-8 shrink-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`w-2 h-2 rounded-full transition-colors ${step === i ? 'bg-foreground' : 'bg-muted'}`} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}