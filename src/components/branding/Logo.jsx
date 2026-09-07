import { cn } from "@/lib/utils";

/**
 * NaliChat logo mark — a bold, punchy "N" monogram forged from
 * sound-wave bars on a vivid neon gradient. Inline SVG so it stays
 * razor-sharp at any size and never depends on a network image.
 *
 * Props:
 *   size  — pixel size (default 32)
 *   className — extra classes on the wrapper
 *   glow  — toggle the outer neon glow (default true)
 */
export default function Logo({ size = 32, className, glow = true }) {
  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        aria-label="NaliChat logo"
      >
        <defs>
          <linearGradient id="nali-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1a0b2e" />
            <stop offset="1" stopColor="#0d0618" />
          </linearGradient>
          <linearGradient id="nali-wave" x1="6" y1="10" x2="42" y2="38" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff2d9b" />
            <stop offset="0.5" stopColor="#a855f7" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id="nali-edge" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff2d9b" stopOpacity="0.9" />
            <stop offset="0.5" stopColor="#a855f7" stopOpacity="0.7" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.9" />
          </linearGradient>
        </defs>

        {/* Rounded tile */}
        <rect x="1" y="1" width="46" height="46" rx="12" fill="url(#nali-bg)" stroke="url(#nali-edge)" strokeWidth="1.5" />

        {/* Bold "N" built from 4 sound-wave bars — thick, punchy, asymmetric like an EQ */}
        <g fill="url(#nali-wave)">
          {/* Left vertical bar */}
          <rect x="11" y="12" width="6.5" height="24" rx="3.25" />
          {/* Right vertical bar */}
          <rect x="30.5" y="12" width="6.5" height="24" rx="3.25" />
          {/* Diagonal connector — the cross-stroke of the N, sliced into 3 segments for a wave feel */}
          <rect x="17" y="14" width="6" height="6.5" rx="3" transform="rotate(26 20 17.25)" />
          <rect x="22.5" y="20.75" width="6" height="6.5" rx="3" transform="rotate(26 25.5 24)" />
          <rect x="24.5" y="27.5" width="6" height="6.5" rx="3" transform="rotate(26 27.5 30.75)" />
        </g>

        {/* Tiny accent dot — the "i" dot over the N, a spark of energy */}
        <circle cx="36.5" cy="11" r="2.2" fill="#22d3ee" />
      </svg>

      {glow && (
        <div
          className="absolute inset-0 rounded-[28%] pointer-events-none"
          style={{ boxShadow: "0 0 16px -2px hsl(285 90% 55% / 0.55)" }}
        />
      )}
    </div>
  );
}