import { motion } from 'framer-motion';
import { Lightbulb, X } from 'lucide-react';
import { useState } from 'react';

export default function TutorialTooltip({ title, description, position = 'top', onDismiss }) {
  const [dismissed, setDismiss] = useState(false);

  if (dismissed) return null;

  const positionClasses = {
    top: 'bottom-full mb-3',
    bottom: 'top-full mt-3',
    left: 'right-full mr-3',
    right: 'left-full ml-3',
  };

  return (
    <motion.div
      className={`absolute ${positionClasses[position]} z-40 bg-gradient-to-br from-primary/95 to-accent/90 backdrop-blur-sm border border-primary/50 rounded-xl px-4 py-3 shadow-2xl shadow-primary/40 pointer-events-auto whitespace-nowrap text-white max-w-xs`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <div className="flex gap-2 items-start">
        <Lightbulb className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold text-white">{title}</p>
          <p className="text-white/80 text-xs mt-0.5">{description}</p>
        </div>
        <button
          onClick={() => setDismiss(true)}
          onClickCapture={(e) => {
            e.stopPropagation();
            onDismiss?.();
            setDismiss(true);
          }}
          className="shrink-0 p-0.5 rounded hover:bg-white/20 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}