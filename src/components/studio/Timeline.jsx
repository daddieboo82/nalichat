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
    const majorTickInterval = 5; // seconds
    const minorTickInterval = 1;

    for (let t = 0; t <= (width / pixelsPerSecond); t += minorTickInterval) {
      const x = t * pixelsPerSecond;
      if (x > width) break;

      const isMajor = t % majorTickInterval === 0;
      const height_tick = isMajor ? 12 : 6;

      ctx.strokeStyle = isMajor ? "hsl(var(--muted-foreground) / 0.5)" : "hsl(var(--muted-foreground) / 0.2)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, canvas.height - height_tick);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = "hsl(var(--muted-foreground))";
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(`${Math.floor(t)}s`, x, canvas.height - 16);
      }
    }

    // Draw playhead
    const playheadX = currentTime * pixelsPerSecond;
    ctx.fillStyle = "hsl(var(--primary))";
    ctx.fillRect(playheadX - 1, 0, 2, canvas.height);

    // Draw triangle indicator
    ctx.fillStyle = "hsl(var(--primary))";
    ctx.beginPath();
    ctx.moveTo(playheadX - 4, 0);
    ctx.lineTo(playheadX + 4, 0);
    ctx.lineTo(playheadX, 8);
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
        className="w-full display-block"
      />
    </div>
  );
}