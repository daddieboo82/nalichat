import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, X, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const checklistItems = [
  { label: "Complete your profile", icon: "👤", path: "/profile" },
  { label: "Create your first project", icon: "🎵", path: "/studio" },
  { label: "Message a collaborator", icon: "💬", path: "/messages" },
  { label: "Upload your first track", icon: "🚀", path: "/explore" },
];

export default function FirstTimeChecklist({ user }) {
  const [completed, setCompleted] = useState(new Set());
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    
    // Load completion state from user data
    const loadCompletionState = async () => {
      try {
        const userData = await base44.auth.me();
        const stored = userData?.onboarding_completed || new Set();
        setCompleted(new Set(Array.isArray(stored) ? stored : []));
      } catch {
        // Default: show checklist
      } finally {
        setIsLoading(false);
      }
    };

    loadCompletionState();
  }, [user?.id]);

  const handleCheck = (index) => {
    const newCompleted = new Set(completed);
    if (newCompleted.has(index)) {
      newCompleted.delete(index);
    } else {
      newCompleted.add(index);
    }
    setCompleted(newCompleted);
    // Optionally save to user data
    base44.auth.updateMe({ onboarding_completed: Array.from(newCompleted) }).catch(() => {});
  };

  if (isLoading || completed.size === checklistItems.length) return null;

  const progress = (completed.size / checklistItems.length) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mb-6 rounded-2xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 overflow-hidden"
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-primary/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="font-semibold text-sm">Getting Started</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {completed.size} of {checklistItems.length} complete
            </div>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Progress bar */}
        <div className="px-5 pb-3">
          <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-pink-500"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Checklist items */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-primary/10 px-5 py-3 space-y-2"
            >
              {checklistItems.map((item, i) => (
                <Link key={i} to={item.path}>
                  <motion.button
                    onClick={(e) => {
                      e.preventDefault();
                      handleCheck(i);
                    }}
                    whileHover={{ x: 4 }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-primary/5 transition-colors text-sm text-left group"
                  >
                    <div
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        completed.has(i)
                          ? "bg-primary border-primary"
                          : "border-primary/30 group-hover:border-primary/50"
                      }`}
                    >
                      {completed.has(i) && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="flex-1">{item.icon} {item.label}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/30 rotate-[-90deg]" />
                  </motion.button>
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}