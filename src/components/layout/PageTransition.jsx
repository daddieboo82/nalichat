import { motion, useReducedMotion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

/**
 * Smooth fade+lift transition on every route change — desktop & mobile.
 */
export default function PageTransition({ children, scroll = true }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      variants={variants}
      initial={reduceMotion ? false : "initial"}
      animate="animate"
      exit={reduceMotion ? undefined : "exit"}
      transition={{ duration: reduceMotion ? 0 : 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`absolute inset-0 h-full min-h-0 w-full min-w-0 ${scroll ? "overflow-x-hidden overflow-y-auto overscroll-y-contain touch-pan-y [-webkit-overflow-scrolling:touch]" : "overflow-hidden"}`}
      style={scroll ? { touchAction: "pan-y", WebkitOverflowScrolling: "touch" } : undefined}
    >
      {children}
    </motion.div>
  );
}