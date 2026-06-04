import { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function Timeline({ currentTime, duration, zoom, onClick }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = "hsl(var(--secondary) / 0.5)";
    ctx.fillRect(0, 0, width, height);

    // Draw grid and time markers
    const pixelsPerSecond = 50 * zoom;
    const majorTickInterval = zoom > 1.5 ? 1 : 5; // More granular with zoom
    const minorTickInterval = 0.5;

    // Draw vertical grid lines
    for (let t = 0; t <= (width / pixelsPerSecond); t += minorTickInterval) {
      const x = t * pixelsPerSecond;
      if (x > width) break;

      const isMajor = t % majorTickInterval === 0;
      const height_tick = isMajor ? 14 : 8;

      ctx.strokeStyle = isMajor ? "hsl(var(--muted-foreground) / 0.4)" : "hsl(var(--muted-foreground) / 0.15)";
      ctx.lineWidth = isMajor ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - height_tick);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      if (isMajor) {
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        const timeStr = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;
        
        ctx.fillStyle = "hsl(var(--muted-foreground) / 0.8)";
        ctx.font = "bold 11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(timeStr, x, canvas.height - 18);
      }
    }

    // Draw playhead with glow
    const playheadX = currentTime * pixelsPerSecond;
    
    // Glow effect
    ctx.shadowColor = "hsl(var(--primary) / 0.6)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "hsl(var(--primary) / 0.3)";
    ctx.fillRect(playheadX - 3, 0, 6, canvas.height);
    
    // Main playhead
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "hsl(var(--primary))";
    ctx.fillRect(playheadX - 1.5, 0, 3, canvas.height);

    // Draw triangle indicator with better styling
    ctx.fillStyle = "hsl(var(--primary))";
    ctx.beginPath();
    ctx.moveTo(playheadX - 5, 0);
    ctx.lineTo(playheadX + 5, 0);
    ctx.lineTo(playheadX, 10);
    ctx.fill();
  }, [currentTime, zoom, duration]);

  const handleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pixelsPerSecond = 50 * zoom;
    const time = x / pixelsPerSecond;
    onClick(time);
  };

  return (
    <div className="border-b border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors">
      <canvas
        ref={canvasRef}
        width={1200}
        height={50}
        onClick={handleClick}
        className="w-full block"
        style={{ display: 'block' }}
      />
    </div>
  );
}