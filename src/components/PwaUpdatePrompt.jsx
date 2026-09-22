import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { usePwaUpdate } from '@/hooks/usePwaUpdate';

/**
 * Non-intrusive banner that appears when a new service worker version is
 * waiting to activate. Gives the user a choice to update now or dismiss
 * for the current session.
 */
export default function PwaUpdatePrompt() {
  const { updateAvailable, applyUpdate } = usePwaUpdate();
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => setDismissed(true);

  return (
    <AnimatePresence>
      {updateAvailable && !dismissed && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md safe-bottom"
        >
          <div className="glass border border-primary/30 rounded-xl p-4 flex items-center gap-3 shadow-lg glow-primary">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground font-heading">Update Available</p>
              <p className="text-xs text-muted-foreground">A new version of NaliBase is ready to install.</p>
            </div>
            <button
              onClick={applyUpdate}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0 min-h-[44px] flex items-center"
            >
              Update
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss update prompt"
              className="w-11 h-11 rounded-lg hover:bg-muted flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}