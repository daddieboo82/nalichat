import { Building2 } from "lucide-react";

export default function SponsorBadge({ challenge, size = "sm" }) {
  if (!challenge?.is_sponsored || !challenge?.sponsor_name) return null;

  const padding = size === "lg" ? "px-3 py-1.5" : "px-2 py-1";
  const textSize = size === "lg" ? "text-xs" : "text-[10px]";
  const iconSize = size === "lg" ? "w-3.5 h-3.5" : "w-3 h-3";

  const content = (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-amber-400/90 text-black font-bold ${padding} ${textSize}`}>
      {challenge.sponsor_logo_url ? (
        <img src={challenge.sponsor_logo_url} alt="" className={`${iconSize} rounded-full object-cover`} />
      ) : (
        <Building2 className={iconSize} />
      )}
      Sponsored by {challenge.sponsor_name}
    </span>
  );

  if (challenge.sponsor_url) {
    return (
      <a
        href={challenge.sponsor_url}
        target="_blank"
        rel="sponsored noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-block ui-hover"
      >
        {content}
      </a>
    );
  }

  return content;
}