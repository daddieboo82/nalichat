import React, { createContext, useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export const OnboardingContext = createContext();

export function OnboardingProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState(new Set());

  useEffect(() => {
    base44.auth.me()
      .then(async (u) => {
        if (u) {
          setUser(u);
          const isNew = !u.onboarding_completed;
          setIsFirstTime(isNew);
          if (isNew) {
            const steps = u.onboarding_steps || [];
            setCompletedSteps(new Set(steps));
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const markStepComplete = async (stepKey) => {
    if (!user) return;
    const updated = new Set(completedSteps);
    updated.add(stepKey);
    setCompletedSteps(updated);
    
    // Persist to user
    const allSteps = Array.from(updated);
    const isComplete = allSteps.length >= 5;
    await base44.auth.updateMe({
      onboarding_steps: allSteps,
      onboarding_completed: isComplete,
    }).catch(() => {});
  };

  const skipOnboarding = async () => {
    if (user) {
      await base44.auth.updateMe({ onboarding_completed: true }).catch(() => {});
      setIsFirstTime(false);
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        isFirstTime,
        loading,
        completedSteps,
        markStepComplete,
        skipOnboarding,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const ctx = React.useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}