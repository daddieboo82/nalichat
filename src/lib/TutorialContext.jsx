import { createContext, useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export const TutorialContext = createContext();

export function TutorialProvider({ children }) {
  const [tutorialActive, setTutorialActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const initTutorial = async () => {
      try {
        const u = await base44.auth.me();
        setUser(u);
        // Check if user has completed tutorial
        const hasCompleted = u?.tutorial_completed === true;
        setCompleted(hasCompleted);
        // Show on first load if not completed
        if (!hasCompleted) {
          setTutorialActive(true);
        }
      } catch (e) {
        // User not logged in or error
      }
    };
    initTutorial();
  }, []);

  const startTutorial = useCallback(() => {
    setCurrentStep(0);
    setTutorialActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const completeTutorial = useCallback(async () => {
    setTutorialActive(false);
    setCompleted(true);
    if (user) {
      try {
        await base44.auth.updateMe({ tutorial_completed: true });
      } catch (e) {
        console.error('Failed to save tutorial completion:', e);
      }
    }
  }, [user]);

  const skipTutorial = useCallback(async () => {
    setTutorialActive(false);
    setCompleted(true);
    if (user) {
      try {
        await base44.auth.updateMe({ tutorial_completed: true });
      } catch (e) {
        console.error('Failed to save tutorial skip:', e);
      }
    }
  }, [user]);

  return (
    <TutorialContext.Provider value={{
      tutorialActive,
      currentStep,
      completed,
      startTutorial,
      nextStep,
      completeTutorial,
      skipTutorial,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}