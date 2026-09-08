import { useState } from "react";
import { Flag, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate_speech", label: "Hate speech" },
  { value: "violence", label: "Violence or threats" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "illegal_activity", label: "Illegal activity" },
  { value: "misinformation", label: "Misinformation" },
  { value: "other", label: "Other" },
];

/**
 * Reusable dialog for reporting user-generated content.
 * Required by Microsoft Store Policy 11.12 (UGC) and 11.16 (AI Content).
 */
export default function ReportContentDialog({ open, onClose, contentType, contentId, contentText, conversationId }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }
    setSubmitting(true);
    try {
      await base44.functions.invoke("reportContent", {
        content_type: contentType,
        content_id: contentId,
        content_text: contentText,
        reason,
        conversation_id: conversationId,
      });
      toast.success("Report submitted. Thank you for helping keep NaliChat safe.");
      setReason("");
      onClose();
    } catch (e) {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-sm bg-card border border-border/60 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-destructive/15 flex items-center justify-center">
                  <Flag className="w-4 h-4 text-destructive" />
                </div>
                <h2 className="font-heading font-bold text-base">Report Content</h2>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-3">
                Help us keep NaliChat safe. Why are you reporting this content?
              </p>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                {REPORT_REASONS.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setReason(r.value)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      reason === r.value
                        ? "bg-destructive/15 text-destructive border border-destructive/30"
                        : "bg-secondary/60 hover:bg-secondary border border-transparent"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 pt-0 flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason || submitting}
                className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? "Submitting..." : "Report"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}