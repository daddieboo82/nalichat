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
import WorldContinuityBar from "@/components/layout/WorldContinuityBar";
import WorldAtmosphere from "@/components/layout/WorldAtmosphere";
import { Link } from "react-router-dom";
import { Gem, Sparkles } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { trackProductEvent } from "@/lib/productAnalytics";

export default function AppLayout() {
  const location = useLocation();
  const [showHelp, setShowHelp] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const { user, authChecked } = useAuth();
  // The public homepage already provides its own header and signup controls.
  const isPublicHome = location.pathname === '/' && authChecked && !user;
  const { subscription, hasPaidAccess, isLoading: subscriptionLoading, isError: subscriptionError } = useSubscription();
  const billingReviewNeeded = subscriptionError || subscription.hasPending;
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
    <div className="relative h-screen h-[100dvh] flex flex-col bg-background overflow-hidden">
      <WorldAtmosphere />
      {/* Mobile Header */}
      {!isDesktop && !isPublicHome && <MobileHeader />}

      {/* Storefront continuity — users remain visibly inside their selected NaliBase mall. */}
      <WorldContinuityBar />

      {user && !subscriptionLoading && !hasPaidAccess && location.pathname !== "/pricing" && (
        <div className="relative z-20 border-b border-amber-400/15 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-pink-500/10 px-3 py-2">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
              <p className="truncate text-xs text-foreground/80">
                <strong className="text-foreground">{billingReviewNeeded ? "Review your existing Premium billing" : <><span className="sm:hidden">Premium from $7.99/mo</span><span className="hidden sm:inline">Unlock NALI.ai + Studio AI from $7.99/mo.</span></>}</strong>
                {!billingReviewNeeded && <span className="hidden sm:inline"> Premium also adds advanced messaging and larger creative transfers.</span>}
              </p>
            </div>
            <Link
              to={billingReviewNeeded ? "/settings" : "/pricing?source=app_upgrade_banner"}
              onClick={() => trackProductEvent(billingReviewNeeded ? "billing_review_click" : "upgrade_click", { source: "app_upgrade_banner", cta: billingReviewNeeded ? "review_billing" : "see_premium" })}
              className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-black text-black shadow-sm transition hover:bg-amber-300"
            >
              <Gem className="h-3.5 w-3.5" /> {billingReviewNeeded ? "Review billing" : "Compare plans"}
            </Link>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`relative z-10 flex-1 overflow-hidden flex flex-col min-h-0 ${isPublicHome ? 'pb-0' : hasAudioPlayer ? 'pb-[calc(7.75rem+env(safe-area-inset-bottom))] lg:pb-[5rem]' : 'pb-[calc(3.75rem+env(safe-area-inset-bottom))] lg:pb-0'}`}>
        <AnimatePresence initial={false} mode="wait">
          <PageTransition key={location.pathname} scroll={!location.pathname.startsWith('/messages')}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      {/* Navigation Bars */}
      {!isDesktop && !isPublicHome && <MobileNav />}
      {isDesktop && !isPublicHome && (
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