import { motion } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Horizontal slide transition for route changes.
 * Slides in from the right (push) and is paired with AnimatePresence in App.jsx.
 * Disabled on desktop to keep web behavior unchanged.
 */
export default function PageTransition({ children }) {
  const isMobile = useIsMobile();

  if (!isMobile) return <>{children}</>;

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -60 }}
      transition={{ type: "tween", ease: "easeInOut", duration: 0.25 }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}