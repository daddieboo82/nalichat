import { useEffect, useRef } from "react";

export default function AudioWaveform({ isPlaying, progress }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    
    // Support High-DPI screens for HD quality
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = 250;
    const cssHeight = 40;
    
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    
    ctx.scale(dpr, dpr);

    // Clear canvas
    ctx.fillStyle = "hsl(var(--secondary))";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Draw animated waveform bars
    const barCount = 40;
    const barWidth = cssWidth / barCount;
    const barGap = 2;

    for (let i = 0; i < barCount; i++) {
      // Generate pseudo-random height based on position (creates consistent waveform)
      const seed = Math.sin(i * 0.5) * 10000;
      const height_ratio = (Math.sin(seed) * 0.5 + 0.5) * 0.8 + 0.2;
      const barHeight = cssHeight * height_ratio;

      const x = i * barWidth + barGap / 2;
      const y = (cssHeight - barHeight) / 2;

      // Color gradient based on progress - using custom green instead of white/accent
      const isPlayed = i / barCount < progress / 100;
      ctx.fillStyle = isPlayed
        ? "#1ED760"
        : "rgba(30, 215, 96, 0.3)";

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth - barGap, barHeight, 2);
      ctx.fill();
    }

    // Draw playhead indicator if playing
    if (isPlaying) {
      const playheadX = (progress / 100) * cssWidth;
      ctx.fillStyle = "#1ED760";
      ctx.fillRect(playheadX - 1, 0, 2, cssHeight);
    }
  }, [progress, isPlaying]);

  return (
    <div className="w-full h-full flex items-center">
      <canvas
        ref={canvasRef}
        className="rounded-lg"
        style={{ width: "250px", height: "40px", display: "block" }}
      />
    </div>
  );
}