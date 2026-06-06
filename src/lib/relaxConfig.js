import {
  Film, Tv, Gamepad2, Share2, BookOpen, ShoppingBag,
  Radio, Music2, Sparkles, Clapperboard
} from "lucide-react";

// Default categories shown in the Relax universe. Admins can add items to any
// existing category, or invent brand-new categories on the fly (any category key
// typed in the add dialog will appear as its own row).
export const RELAX_CATEGORIES = [
  { key: "movies", label: "Movies", icon: Film, gradient: "from-red-500 to-orange-500", blurb: "Top films to unwind" },
  { key: "tv", label: "TV Shows", icon: Tv, gradient: "from-indigo-500 to-purple-500", blurb: "Binge-worthy series" },
  { key: "games", label: "Video Games", icon: Gamepad2, gradient: "from-green-500 to-emerald-500", blurb: "Play & explore" },
  { key: "social", label: "Social Apps", icon: Share2, gradient: "from-sky-500 to-blue-500", blurb: "Stay connected" },
  { key: "books", label: "Books", icon: BookOpen, gradient: "from-amber-500 to-yellow-500", blurb: "Read & dream" },
  { key: "shopping", label: "Shopping", icon: ShoppingBag, gradient: "from-pink-500 to-rose-500", blurb: "Treat yourself" },
  { key: "radio", label: "Radio Stations", icon: Radio, gradient: "from-teal-500 to-cyan-500", blurb: "Live on air" },
  { key: "music", label: "Music", icon: Music2, gradient: "from-violet-500 to-fuchsia-500", blurb: "Vibe & flow" },
];

export const getCategoryMeta = (key) =>
  RELAX_CATEGORIES.find((c) => c.key === key) || {
    key,
    label: key ? key.charAt(0).toUpperCase() + key.slice(1) : "More",
    icon: Sparkles,
    gradient: "from-slate-500 to-slate-700",
    blurb: "Curated picks",
  };

export const FALLBACK_THUMB =
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=600&auto=format&fit=crop";

// Convert common watch URLs into embeddable player URLs.
export function toEmbedUrl(url, mediaType) {
  if (!url) return "";
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "");

    // YouTube — use the privacy-enhanced nocookie domain which avoids most
    // "embedding disabled" (error 150/153) restrictions.
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
      if (u.pathname.startsWith("/embed/")) return `${url.replace("youtube.com", "youtube-nocookie.com")}${url.includes("?") ? "&" : "?"}autoplay=1`;
    }
    if (host === "youtu.be") {
      const id = u.pathname.slice(1);
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
    }

    // Vimeo
    if (host === "vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}?autoplay=1`;
    }

    // Spotify
    if (host === "open.spotify.com") {
      return `https://open.spotify.com/embed${u.pathname}`;
    }
  } catch {
    return url;
  }
  return url;
}

export function isDirectMedia(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mp3|wav|m4a|aac|flac)(\?.*)?$/i.test(url);
}