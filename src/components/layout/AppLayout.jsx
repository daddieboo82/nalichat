import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/layout/PageTransition";
import { useEffect, useRef, useState } from "react";
import { useAudioPlayer } from "@/lib/AudioPlayerContext";
import { useAuth } from "@/lib/AuthContext";

import DesktopNav from "@/components/navigation/DesktopNav";
import MobileHeader from "@/components/navigation/MobileHeader";
import MobileNav from "@/components/navigation/MobileNav";
import { useSystemTheme } from "@/hooks/use-system-theme";
import { useMediaQuery } from "@/hooks/use-media-query";
import GlobalInviteDialog from "@/components/GlobalInviteDialog";
import GlobalMessageDialog from "@/components/GlobalMessageDialog";
import GlobalHelpDialog from "@/components/GlobalHelpDialog";
import GlobalAudioPlayer from "@/components/audio/GlobalAudioPlayer";
import WorldContinuityBar from "@/components/layout/WorldContinuityBar";\nimport WorldAtmosphere from "@/components/layout/WorldAtmosphere";

export default function AppLayout() {
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const { user } = useAuth();
  const lastUserIdRef = useRef(user?.id || null);
  const audioPlayer = useAudioPlayer();
  const hasAudioPlayer = !!audioPlayer?.currentTrack;
  // Both nav bars used to mount at every viewport and were only hidden with
  // CSS, so the notification bell inside each one ran twice: two /me calls, two
  // notification fetches, two realtime subscriptions and, on every incoming
  // notification, a duplicated toast, sound and push. Mount only the bar the
  // current breakpoint actually shows. `lg` matches the Tailwind classes below.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useSystemTheme();

  useEffect(() => {
    const nextUserId = user?.id || null;
    if (lastUserIdRef.current === nextUserId) return;
    lastUserIdRef.current = nextUserId;
    setShowHelp(false);
    setShowInvite(false);
    setShowMessage(false);
  }, [user?.id]);

  return (
    <div className="relative h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">\n      <WorldAtmosphere />
      {/* Mobile Header */}
      {!isDesktop && <MobileHeader />}

      {/* Storefront continuity — users remain visibly inside their selected NaliBase mall. */}
      <WorldContinuityBar />

      {/* Main Content */}
      <main className={`flex-1 overflow-hidden ${hasAudioPlayer ? 'pb-[calc(7.75rem+env(safe-area-inset-bottom))] lg:pb-[5rem]' : 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0'}`}>
        <AnimatePresence initial={false}>
          <PageTransition key={location.pathname} scroll={!location.pathname.startsWith('/messages')}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Navigation Bars */}
      {!isDesktop && <MobileNav />}
      {isDesktop && (
        <DesktopNav
          onMessageClick={() => setShowMessage(true)}
          onInviteClick={() => setShowInvite(true)}
          onHelpClick={() => setShowHelp(true)}
        />
      )}



      {/* Modals */}
      <GlobalInviteDialog open={showInvite} onOpenChange={setShowInvite} />
      <GlobalMessageDialog open={showMessage} onOpenChange={setShowMessage} />
      <GlobalHelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <GlobalAudioPlayer />
    </div>
  );
}