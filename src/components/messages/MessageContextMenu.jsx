import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

/**
 * A positioned context menu rendered in a portal.
 * Shown on long-press (mobile) or right-click (desktop) on a message bubble.
 * Closes on outside click, Escape, or scroll.
 */
export default function MessageContextMenu({ position, items, onClose }) {
  if (!position) return null;

  const menuWidth = 190;
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1024;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 768;
  const safeLeft = Math.max(8, Math.min(position.x, viewportWidth - menuWidth - 8));
  const safeTop = Math.max(8, Math.min(position.y, viewportHeight - Math.min(items.length * 48 + 12, viewportHeight - 16)));

  const handleKeyDown = (e) => {
    if (e.key === "Escape") onClose();
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[99]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} onKeyDown={handleKeyDown} tabIndex={-1}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -4 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className="fixed z-[100] min-w-[190px] rounded-xl bg-popover/95 backdrop-blur-xl border border-border/60 shadow-2xl p-1.5"
          style={{ left: safeLeft, top: safeTop, maxHeight: "calc(100dvh - 16px)", overflowY: "auto" }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => { item.onClick?.(); onClose(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors hover:bg-secondary/80 min-h-[44px] text-left ${
                item.highlight ? "text-primary" : ""
              } ${item.destructive ? "text-destructive hover:bg-destructive/10" : ""}`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}