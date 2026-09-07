import { motion } from "framer-motion";

const variants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Smooth fade+lift transition on every route change — desktop & mobile.
 */
export default function PageTransition({ children }) {
  return (
    <motion.div
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative h-full w-full overflow-y-auto"
    >
      {children}
    </motion.div>
  );
}