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

  const hoverLineRef = useRef(null);
  const hoverLabelRef = useRef(null);

  // Map a pointer event to an exact time — accounts for canvas scaling so
  // clicks land with millisecond precision at any container width.
  const timeFromEvent = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scale;
    return Math.max(0, x / (50 * zoom));
  };

  const handleClick = (e) => {
    if (!canvasRef.current) return;
    onClick(timeFromEvent(e));
  };

  const handleMove = (e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const t = timeFromEvent(e);
    if (hoverLineRef.current) {
      hoverLineRef.current.style.left = `${e.clientX - rect.left}px`;
      hoverLineRef.current.style.opacity = '1';
    }
    if (hoverLabelRef.current) {
      const m = Math.floor(t / 60), s = Math.floor(t % 60), ms = Math.floor((t % 1) * 1000);
      hoverLabelRef.current.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    }
  };

  const handleLeave = () => {
    if (hoverLineRef.current) hoverLineRef.current.style.opacity = '0';
  };

  return (
    <div className="relative border-b border-border bg-card/50 cursor-pointer hover:bg-card/70 transition-colors">
      <canvas
        ref={canvasRef}
        width={1200}
        height={50}
        onClick={handleClick}
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
        className="w-full block"
        style={{ display: 'block' }}
      />
      {/* Live precision crosshair */}
      <div ref={hoverLineRef} className="absolute top-0 bottom-0 w-px bg-white/40 pointer-events-none opacity-0" style={{ left: 0 }}>
        <div ref={hoverLabelRef} className="absolute top-0.5 left-1.5 bg-black/85 text-white/90 text-[9px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap border border-white/10 shadow-lg" />
      </div>
    </div>
  );
}