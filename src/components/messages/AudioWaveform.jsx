import { useEffect, useRef } from "react";

export default function AudioWaveform({ src, isPlaying, progress }) {
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = "hsl(var(--secondary))";
    ctx.fillRect(0, 0, width, height);

    // Draw animated waveform bars
    const barCount = 40;
    const barWidth = width / barCount;
    const barGap = 2;

    for (let i = 0; i < barCount; i++) {
      // Generate pseudo-random height based on position (creates consistent waveform)
      const seed = Math.sin(i * 0.5) * 10000;
      const height_ratio = (Math.sin(seed) * 0.5 + 0.5) * 0.8 + 0.2;
      const barHeight = height * height_ratio;

      const x = i * barWidth + barGap / 2;
      const y = (height - barHeight) / 2;

      // Color gradient based on progress
      const isPlayed = i / barCount < progress / 100;
      ctx.fillStyle = isPlayed
        ? "hsl(var(--accent))"
        : "hsl(var(--muted-foreground) / 0.4)";

      ctx.fillRect(x, y, barWidth - barGap, barHeight);
    }

    // Draw playhead indicator if playing
    if (isPlaying) {
      const playheadX = (progress / 100) * width;
      ctx.fillStyle = "hsl(var(--accent))";
      ctx.fillRect(playheadX - 1, 0, 2, height);
    }
  }, [progress, isPlaying]);

  return (
    <div className="w-full">
      <canvas
        ref={canvasRef}
        width={250}
        height={40}
        className="w-full rounded-lg cursor-pointer"
        style={{ display: "block" }}
      />
      <audio ref={audioRef} src={src} />
    </div>
  );
}