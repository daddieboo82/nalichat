import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * NaliBase logo mark — "Chat + Wave Fuse".
 * A rounded chat-bubble outline whose tail curls into the first of three
 * diagonal sound-wave bars, so message and sound read as one continuous
 * shape. Vivid neon gradient (magenta → purple → cyan) flows across both
 * the bubble stroke and the interior bars. Inline SVG — razor-sharp at any
 * size, no network dependency.
 *
 * Props:
 *   size     — pixel size (default 32)
 *   className — extra classes on the wrapper
 *   glow     — toggle the outer neon glow (default true)
 *   label    — accessible brand label (default "NaliBase logo")
 */
export default function Logo({ size = 32, className, glow = true, label = "NaliBase logo" }) {
  const uid = useId();
  const tileId = `nali-tile-${uid}`;
  const neonId = `nali-neon-${uid}`;

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
        aria-label={label}
      >
        <defs>
          <radialGradient id={tileId} cx="0.5" cy="0.38" r="0.8">
            <stop offset="0" stopColor="#202030" />
            <stop offset="0.6" stopColor="#14141e" />
            <stop offset="1" stopColor="#0a0a10" />
          </radialGradient>
          <linearGradient id={neonId} x1="8" y1="40" x2="40" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff2d9b" />
            <stop offset="0.5" stopColor="#9d3aff" />
            <stop offset="1" stopColor="#22d3ee" />
          </linearGradient>
          <linearGradient id={`${neonId}-stroke`} x1="8" y1="40" x2="40" y2="8" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff5dae" />
            <stop offset="0.5" stopColor="#b05eff" />
            <stop offset="1" stopColor="#4ae0f5" />
          </linearGradient>
        </defs>

        {/* Dark rounded tile with subtle radial illumination */}
        <rect x="1" y="1" width="46" height="46" rx="12" fill={`url(#${tileId})`} />
        {/* Subtle inner border for depth */}
        <rect x="1.5" y="1.5" width="45" height="45" rx="11.5" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="1" />

        {/* Chat bubble outline — rounded square body with a tail curling
            out of the bottom-left toward the first wave bar */}
        <path
          d="M 21 13
             L 27 13
             Q 35 13 35 21
             L 35 27
             Q 35 35 27 35
             L 23 35
             L 15.5 40.5
             L 17.5 34.6
             Q 13 34 13 27
             L 13 21
             Q 13 13 21 13 Z"
          fill="none"
          stroke={`url(#${`${neonId}-stroke`})`}
          strokeWidth="2.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Three vertical equalizer bars inside the bubble — reads instantly
            as sound/audio fused with the chat bubble (message → sound) */}
        <g fill={`url(#${neonId})`}>
          <rect x="16.5" y="24" width="3.2" height="8" rx="1.6" />
          <rect x="22.4" y="18" width="3.2" height="14" rx="1.6" />
          <rect x="28.3" y="22" width="3.2" height="10" rx="1.6" />
        </g>
      </svg>

      {glow && (
        <div
          className="absolute inset-0 rounded-[28%] pointer-events-none"
          style={{ boxShadow: "0 0 14px -2px hsl(320 90% 55% / 0.45), 0 0 22px -6px hsl(190 90% 50% / 0.3)" }}
        />
      )}
    </div>
  );
}