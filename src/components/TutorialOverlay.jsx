import { useContext, useEffect, useState } from 'react';
import { TutorialContext } from '@/lib/TutorialContext';
import { tutorialSteps } from '@/lib/tutorialSteps';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TutorialOverlay() {
  const { tutorialActive, currentStep, nextStep, completeTutorial, skipTutorial } = useContext(TutorialContext);
  const [targetRect, setTargetRect] = useState(null);
  const step = tutorialSteps[currentStep];

  useEffect(() => {
    if (!tutorialActive || !step?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const updateTarget = () => {
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateTarget();
    window.addEventListener('resize', updateTarget);
    return () => window.removeEventListener('resize', updateTarget);
  }, [tutorialActive, step?.targetSelector]);

  const handleNext = () => {
    if (currentStep === tutorialSteps.length - 1) {
      completeTutorial();
    } else {
      nextStep();
    }
  };

  if (!tutorialActive) return null;

  const isLastStep = currentStep === tutorialSteps.length - 1;
  const padding = 12;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[999] pointer-events-none">
        {/* Overlay */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Highlight box */}
        {targetRect && (
          <motion.div
            className="absolute border-2 border-primary shadow-2xl shadow-primary/50 rounded-2xl pointer-events-none"
            style={{
              top: targetRect.top - padding,
              left: targetRect.left - padding,
              width: targetRect.width + padding * 2,
              height: targetRect.height + padding * 2,
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        )}

        {/* Content Box */}
        <motion.div
          className="absolute bg-card border border-primary/30 rounded-2xl shadow-2xl shadow-primary/30 p-6 max-w-sm pointer-events-auto"
          style={{
            top: targetRect
              ? Math.min(targetRect.top - 200, window.innerHeight - 300)
              : '50%',
            left: targetRect
              ? Math.max(targetRect.left + targetRect.width + 30, 20)
              : '50%',
            transform: !targetRect ? 'translate(-50%, -50%)' : undefined,
          }}
          initial={{ scale: 0.8, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <div className="space-y-4">
            <div>
              <h3 className="font-heading font-bold text-lg text-primary mb-1">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {tutorialSteps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${
                      i <= currentStep ? 'bg-primary' : 'bg-border'
                    }`}
                    style={{ width: i <= currentStep ? '8px' : '4px' }}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground/70 ml-auto">
                {currentStep + 1} / {tutorialSteps.length}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={skipTutorial}
                className="text-muted-foreground hover:text-foreground"
              >
                <SkipForward className="w-3.5 h-3.5 mr-1.5" />
                Skip
              </Button>
              <Button
                onClick={handleNext}
                className="flex-1 bg-gradient-to-r from-primary to-pink-500 hover:opacity-90 text-white"
              >
                {isLastStep ? 'Finish' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1.5" />}
              </Button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={skipTutorial}
            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 flex items-center justify-center transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}