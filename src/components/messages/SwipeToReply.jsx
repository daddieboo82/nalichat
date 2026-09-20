import { useRef, useState } from "react";
import { Reply } from "lucide-react";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 60; // px to trigger reply
const SWIPE_MAX = 90; // max visual drag
const SWIPE_REVEAL = 40; // icon reveal distance

/**
 * Mobile-only swipe-to-reply wrapper.
 * On touch devices, swiping right on a message reveals a reply icon and
 * triggers onReply when released past the threshold.
 * On desktop, renders children untouched (hover buttons handle reply).
 */
export default function SwipeToReply({ children, isOwn, onReply, disabled }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const active = useRef(false);
  const isTouchDevice = useRef(
    typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );

  // Don't wrap on desktop — hover buttons already handle reply
  if (!isTouchDevice.current || disabled) return children;

  const handleTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    active.current = false; // confirm horizontal intent first
    setIsDragging(false);
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;

    // Only start tracking if horizontal movement dominates (avoid killing vertical scroll)
    if (!active.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx)) return; // vertical scroll — don't capture
      active.current = true;
      setIsDragging(true);
    }

    if (active.current) {
      // For own messages (right-aligned), swipe left; for others, swipe right
      const direction = isOwn ? -1 : 1;
      const clamped = Math.max(0, Math.min(SWIPE_MAX, dx * direction));
      setDragX(clamped * direction);
    }
  };

  const handleTouchEnd = () => {
    if (active.current) {
      const direction = isOwn ? -1 : 1;
      const effectiveDrag = dragX * direction;
      if (effectiveDrag >= SWIPE_THRESHOLD) {
        if (navigator.vibrate) navigator.vibrate(30);
        onReply?.();
      }
    }
    active.current = false;
    setIsDragging(false);
    setDragX(0);
  };

  const revealOpacity = Math.min(1, Math.abs(dragX) / SWIPE_REVEAL);
  const direction = isOwn ? -1 : 1;

  return (
    <div className="relative overflow-visible">
      {/* Reply icon revealed behind the bubble */}
      <div
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 border border-primary/30 transition-opacity",
          isOwn ? "right-2" : "left-2"
        )}
        style={{ opacity: revealOpacity }}
      >
        <Reply className="w-5 h-5 text-primary" />
      </div>

      {/* Draggable message content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 0.25s cubic-bezier(0.2, 0, 0, 1)",
          willChange: isDragging ? "transform" : "auto",
        }}
        className="relative z-10 touch-pan-y"
      >
        {children}
      </div>
    </div>
  );
}