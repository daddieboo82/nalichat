import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import { useState } from "react";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";

import DesktopNav from "@/components/navigation/DesktopNav";
import MobileHeader from "@/components/navigation/MobileHeader";
import MobileNav from "@/components/navigation/MobileNav";
import { useSystemTheme } from "@/hooks/use-system-theme";
import GlobalInviteDialog from "@/components/GlobalInviteDialog";
import GlobalMessageDialog from "@/components/GlobalMessageDialog";
import GlobalHelpDialog from "@/components/GlobalHelpDialog";
import GlobalAudioPlayer from "@/components/audio/GlobalAudioPlayer";
import CartDrawer from "@/components/shop/CartDrawer";

export default function AppLayout() {
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const audioPlayer = useAudioPlayer();
  const hasAudioPlayer = !!audioPlayer?.currentTrack;

  useSystemTheme();

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Mobile Header */}
      <MobileHeader />

      {/* Main Content */}
      <main className={`flex-1 overflow-hidden ${hasAudioPlayer ? 'pb-[calc(7.75rem+env(safe-area-inset-bottom))] lg:pb-[5rem]' : 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0'}`}>
        <AnimatePresence initial={false}>
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



      {/* Modals */}
      <GlobalInviteDialog open={showInvite} onOpenChange={setShowInvite} />
      <GlobalMessageDialog open={showMessage} onOpenChange={setShowMessage} />
      <GlobalHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <GlobalAudioPlayer />
      <CartDrawer />
    </div>
  );
}