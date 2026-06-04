import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Zap } from 'lucide-react';

export default function AudioAnalysisPanel({ analysis, isProcessing }) {
  if (!analysis) return null;

  const { before, after, gainApplied } = analysis;
  const improved = after.integrativeLouds > before.integrativeLouds || 
                   after.dynamicRange > before.dynamicRange;

  const getMeterColor = (value, target) => {
    const diff = Math.abs(value - target);
    if (diff < 1) return 'text-accent';
    if (diff < 3) return 'text-yellow-500';
    return 'text-destructive';
  };

  const getClippingIcon = (risk) => {
    if (risk === 'Low') return <CheckCircle2 className="w-4 h-4 text-accent" />;
    if (risk === 'Medium') return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    return <AlertCircle className="w-4 h-4 text-destructive" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Processing Status */}
      {isProcessing && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-primary/20 border border-primary/30">
          <Zap className="w-4 h-4 text-primary animate-pulse" />
          <span className="text-sm text-primary font-semibold">Analyzing & Mastering...</span>
        </div>
      )}

      {/* Analysis Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Before Analysis */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Before</div>
          <div className="space-y-2.5 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Loudness</span>
              <span className={`text-sm font-bold ${getMeterColor(before.integrativeLouds, -14)}`}>
                {before.integrativeLouds} LUFS
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Peak</span>
              <span className="text-sm font-mono text-foreground">{before.peakDb} dBFS</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Dynamic Range</span>
              <span className="text-sm font-mono text-foreground">{before.dynamicRange} dB</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Clipping Risk</span>
              <div className="flex items-center gap-1.5">
                {getClippingIcon(before.clippingRisk)}
                <span className="text-xs font-semibold">{before.clippingRisk}</span>
              </div>
            </div>
          </div>
        </div>

        {/* After Analysis */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-accent uppercase tracking-wide">✓ Mastered</div>
          <div className="space-y-2.5 p-3 rounded-lg bg-accent/10 border border-accent/30">
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Loudness</span>
              <span className={`text-sm font-bold ${improved ? 'text-accent' : 'text-foreground'}`}>
                {after.integrativeLouds} LUFS
              </span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Peak</span>
              <span className="text-sm font-mono text-foreground">{after.peakDb} dBFS</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Dynamic Range</span>
              <span className="text-sm font-mono text-foreground">{after.dynamicRange} dB</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-xs text-muted-foreground">Clipping Risk</span>
              <div className="flex items-center gap-1.5">
                {getClippingIcon(after.clippingRisk)}
                <span className="text-xs font-semibold">{after.clippingRisk}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gain Applied */}
      <div className="text-center p-2 rounded-lg bg-secondary/40 border border-border/50">
        <div className="text-xs text-muted-foreground mb-1">Gain Applied</div>
        <div className="text-lg font-bold text-primary">
          {(gainApplied > 1 ? '+' : '')}{Math.round((20 * Math.log10(gainApplied)) * 10) / 10} dB
        </div>
      </div>
    </motion.div>
  );
}