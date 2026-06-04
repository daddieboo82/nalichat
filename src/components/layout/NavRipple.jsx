import { useEffect, useRef } from "react";

/**
 * Invisible overlay that renders a radial ripple wherever the user taps/clicks.
 * Purely visual — pointer-events: none so it never blocks interaction.
 */
export default function NavRipple() {
  const canvasRef = useRef(null);
  const ripples = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const addRipple = (e) => {
      const x = e.clientX ?? e.touches?.[0]?.clientX;
      const y = e.clientY ?? e.touches?.[0]?.clientY;
      if (x == null) return;
      ripples.current.push({ x, y, r: 0, alpha: 0.55, born: Date.now() });
    };
    window.addEventListener("click", addRipple);
    window.addEventListener("touchstart", addRipple, { passive: true });

    let rafId;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const now = Date.now();
      ripples.current = ripples.current.filter(rp => rp.alpha > 0.01);
      for (const rp of ripples.current) {
        const age = (now - rp.born) / 600; // 0→1 over 600ms
        rp.r = age * 80;
        rp.alpha = (1 - age) * 0.35;
        ctx.beginPath();
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(265, 80%, 70%, ${rp.alpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("click", addRipple);
      window.removeEventListener("touchstart", addRipple);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-[9998] pointer-events-none"
      aria-hidden="true"
    />
  );
}