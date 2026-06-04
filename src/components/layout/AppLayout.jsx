import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import { useState } from "react";
import AiAssistant from "@/components/AiAssistant";
import DesktopNav from "@/components/navigation/DesktopNav";
import MobileHeader from "@/components/navigation/MobileHeader";
import MobileNav from "@/components/navigation/MobileNav";
import { useSystemTheme } from "@/hooks/use-system-theme";
import { useOnboarding } from "@/lib/OnboardingContext";
import OnboardingOverlay from "@/components/onboarding/OnboardingOverlay";
import GlobalInviteDialog from "@/components/GlobalInviteDialog";
import GlobalMessageDialog from "@/components/GlobalMessageDialog";
import GlobalAudioPlayer from "@/components/audio/GlobalAudioPlayer";

export default function AppLayout() {
  const location = useLocation();
  const { skipOnboarding } = useOnboarding();
  const [showHelp, setShowHelp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMessage, setShowMessage] = useState(false);

  useSystemTheme();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content */}
      <main className="flex-1 overflow-hidden pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Navigation Bars */}
      <MobileNav />
      <DesktopNav 
        onMessageClick={() => setShowMessage(true)}
        onInviteClick={() => setShowInvite(true)}
        onHelpClick={() => setShowHelp(true)}
      />

      {/* Omnipresent AI */}
      <AiAssistant />

      {/* Modals */}
      <OnboardingOverlay
        isOpen={showHelp}
        onComplete={() => setShowHelp(false)}
        completedSteps={new Set()}
      />
      <GlobalInviteDialog open={showInvite} onOpenChange={setShowInvite} />
      <GlobalMessageDialog open={showMessage} onOpenChange={setShowMessage} />
      <GlobalAudioPlayer />
    </div>
  );
}