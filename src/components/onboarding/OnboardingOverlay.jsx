import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const steps = [
  {
    key: 'explore',
    title: '🎵 Explore & Discover',
    desc: 'Browse music from other artists, like tracks, and build playlists.',
    highlight: 'Explore',
    image: '✨',
  },
  {
    key: 'studio',
    title: '🎚️ Create in Studio',
    desc: 'Upload tracks, manage multi-track projects, and mix audio.',
    highlight: 'Studio',
    image: '🎛️',
  },
  {
    key: 'record',
    title: '🎤 Record & Share',
    desc: 'Record new tracks with visual feedback and share your creations.',
    highlight: 'Record',
    image: '🎙️',
  },
  {
    key: 'messages',
    title: '💬 Collaborate',
    desc: 'Message artists, share files, and work together in real-time.',
    highlight: 'Messages',
    image: '📧',
  },
  {
    key: 'network',
    title: '🌐 Build Network',
    desc: 'Follow artists, connect with creators, and grow your community.',
    highlight: 'Network',
    image: '🤝',
  },
];

export default function OnboardingOverlay({ isOpen, onComplete, completedSteps }) {
  const [currentStep, setCurrentStep] = React.useState(0);
  const step = steps[currentStep];
  const isCompleted = completedSteps.has(step.key);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-5xl mb-3">{step.image}</div>
                <h2 className="text-2xl font-heading font-bold text-foreground">{step.title}</h2>
              </div>
              <button
                onClick={onComplete}
                className="p-2 rounded-lg text-muted-foreground hover:bg-secondary/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-muted-foreground mb-6 leading-relaxed">{step.desc}</p>

            {/* Progress */}
            <div className="flex gap-1.5 mb-6">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-all',
                    i <= currentStep ? 'bg-primary' : 'bg-secondary/30'
                  )}
                />
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center gap-2">
              <Button
                onClick={handleNext}
                className="flex-1 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 rounded-lg font-semibold shadow-lg shadow-primary/20"
              >
                {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
              {currentStep > 0 && (
                <Button
                  variant="ghost"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="rounded-lg"
                >
                  Back
                </Button>
              )}
            </div>

            {/* Skip */}
            <button
              onClick={onComplete}
              className="w-full mt-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}