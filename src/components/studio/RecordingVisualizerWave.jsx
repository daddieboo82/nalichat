import { useEffect, useRef } from "react";

export default function RecordingVisualizerWave({ audioLevel }) {
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const barsRef = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const barCount = 40;

    // Initialize bars
    if (barsRef.current.length === 0) {
      barsRef.current = Array(barCount)
        .fill(0)
        .map(() => ({ height: 0, targetHeight: 0 }));
    }

    const animate = () => {
      // Clear canvas
      ctx.fillStyle = "hsl(240 10% 3%)";
      ctx.fillRect(0, 0, width, height);

      const barWidth = width / barCount;
      const centerY = height / 2;

      barsRef.current.forEach((bar, i) => {
        // Update heights with smoothing
        bar.targetHeight =
          Math.sin((i / barCount) * Math.PI + Date.now() / 1000) *
            (audioLevel / 100) *
            (height / 2.5) +
          (audioLevel / 100) * (height / 3);
        bar.height += (bar.targetHeight - bar.height) * 0.1;

        const barHeight = Math.max(bar.height, 2);

        // Draw bar
        const gradient = ctx.createLinearGradient(0, centerY - barHeight, 0, centerY + barHeight);
        gradient.addColorStop(0, "hsl(265 80% 60% / 0.8)");
        gradient.addColorStop(0.5, "hsl(175 70% 45% / 1)");
        gradient.addColorStop(1, "hsl(265 80% 60% / 0.8)");

        ctx.fillStyle = gradient;
        ctx.fillRect(i * barWidth + 1, centerY - barHeight, barWidth - 2, barHeight * 2);
      });

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [audioLevel]);

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={600}
        height={120}
        className="w-full border border-border/30 rounded-lg bg-secondary/20"
      />
      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground">Level:</div>
        <div className="w-32 h-2 bg-secondary/40 rounded-full overflow-hidden border border-border/30">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all"
            style={{ width: `${audioLevel}%` }}
          />
        </div>
        <div className="text-xs font-mono font-bold text-primary w-8">{Math.round(audioLevel)}%</div>
      </div>
    </div>
  );
}