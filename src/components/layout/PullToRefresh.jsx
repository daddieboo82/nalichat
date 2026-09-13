import { useState, useRef } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const THRESHOLD = 70;

/**
 * Native-style pull-to-refresh wrapper for a scrollable container.
 * Wraps content and triggers `onRefresh` when the user pulls down past the
 * threshold while already scrolled to the top. Mobile only — on desktop it
 * renders the scroll container untouched.
 */
export default function PullToRefresh({ onRefresh, className, children }) {
  const isMobile = useIsMobile();
  const scrollRef = useRef(null);
  const startY = useRef(0);
  const pulling = useRef(false);
  const activeScrollerRef = useRef(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = (e) => {
    if (!isMobile || refreshing) return;
    const wrapper = scrollRef.current;
    if (!wrapper) return;

    // The wrapped content may own the real vertical scroller (Messages does).
    // Walk up from the touched element and use the first scrollable descendant
    // instead of assuming this wrapper's scrollTop is authoritative.
    let node = e.target instanceof Element ? e.target : null;
    let scroller = null;
    while (node && node !== wrapper) {
      const style = window.getComputedStyle(node);
      const canScrollY = /(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight;
      if (canScrollY) {
        scroller = node;
        break;
      }
      node = node.parentElement;
    }
    activeScrollerRef.current = scroller || wrapper;
    if (activeScrollerRef.current.scrollTop <= 0) {
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    }
  };

  const onTouchMove = (e) => {
    if (!pulling.current) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      // Resistance curve so it feels rubbery
      setPull(Math.min(delta * 0.5, THRESHOLD + 30));
    }
  };

  const onTouchEnd = async () => {
    if (!pulling.current) {
      activeScrollerRef.current = null;
      return;
    }
    pulling.current = false;
    activeScrollerRef.current = null;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  if (!isMobile) {
    return (
      <div ref={scrollRef} className={className}>
        {children}
      </div>
    );
  }

  const progress = Math.min(pull / THRESHOLD, 1);

  return (
    <div className="relative h-full overflow-hidden">
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-center pointer-events-none z-10"
        style={{ height: pull, opacity: progress }}
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        ) : (
          <ArrowDown
            className={cn(
              "w-5 h-5 text-primary transition-transform",
              progress >= 1 && "rotate-180"
            )}
          />
        )}
      </div>
      <div
        ref={scrollRef}
        className={className}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateY(${pull}px)`,
          transition: pulling.current ? "none" : "transform 0.25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}