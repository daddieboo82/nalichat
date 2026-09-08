import { useState } from "react";
import { Copy, Check, ChevronDown, Hash, MessageCircle, Video, FileText, Send, Youtube, Repeat2, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyToClipboard } from "@/lib/clipboard";
import { motion, AnimatePresence } from "framer-motion";

const PLATFORMS = [
  { key: "tiktok_script", label: "TikTok / Reels", icon: Video, color: "text-pink-400" },
  { key: "reddit_post", label: "Reddit Post", icon: FileText, color: "text-orange-400" },
  { key: "discord_message", label: "Discord", icon: MessageCircle, color: "text-indigo-400" },
  { key: "x_thread", label: "X Thread", icon: Send, color: "text-sky-400" },
  { key: "youtube_shorts_script", label: "YouTube Shorts", icon: Youtube, color: "text-red-400" },
];

function CopyBlock({ label, content, icon: Icon, color }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    copyToClipboard(content || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-secondary/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/40 transition-colors text-left"
      >
        <Icon className={cn("w-4 h-4 shrink-0", color)} />
        <span className="text-xs font-semibold flex-1">{label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-3 pb-3">
              <div className="relative">
                <pre className="text-[12px] text-muted-foreground whitespace-pre-wrap font-body leading-relaxed pr-10 max-h-64 overflow-y-auto">
                  {content || "No content generated."}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-secondary/80 flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
                  title="Copy"
                  aria-label={`Copy ${label}`}
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ViralConceptCard({ concept, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 sm:p-5 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-base text-foreground">{concept.title || `Concept ${index + 1}`}</h3>
          <p className="text-[12px] text-muted-foreground mt-0.5">{concept.hook || ""}</p>
        </div>
        {concept.emotional_trigger && (
          <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent uppercase tracking-wider">
            {concept.emotional_trigger}
          </span>
        )}
      </div>

      {/* Platform content blocks */}
      <div className="space-y-2">
        {PLATFORMS.map((p) => (
          <CopyBlock key={p.key} label={p.label} content={concept[p.key]} icon={p.icon} color={p.color} />
        ))}
      </div>

      {/* Viral loop */}
      {concept.viral_loop && (
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
          <Repeat2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-semibold text-primary uppercase tracking-wider mb-0.5">Viral Loop</p>
            <p className="text-[12px] text-muted-foreground">{concept.viral_loop}</p>
          </div>
        </div>
      )}

      {/* Hashtags */}
      {concept.hashtags && concept.hashtags.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {concept.hashtags.map((tag, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Communities */}
      {concept.communities && concept.communities.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {concept.communities.map((comm, i) => (
            <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">
              {comm}
            </span>
          ))}
        </div>
      )}

      {/* Screenshot caption + CTA */}
      {concept.screenshot_caption && (
        <div className="rounded-xl bg-secondary/30 px-3 py-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Screenshot Caption</p>
          <p className="text-[12px] text-foreground">{concept.screenshot_caption}</p>
        </div>
      )}

      {concept.cta && (
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary/10 to-pink-500/10 border border-primary/20 px-3 py-2.5">
          <Megaphone className="w-4 h-4 text-primary shrink-0" />
          <p className="text-[12px] font-medium text-primary">{concept.cta}</p>
        </div>
      )}
    </motion.div>
  );
}