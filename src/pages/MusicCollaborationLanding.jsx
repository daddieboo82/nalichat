import { useEffect } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Music, Sparkles, FileAudio, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { captureMarketingAttribution, getMarketingAttribution } from "@/lib/adAttribution";

function attributedPath(path) {
  const attribution = getMarketingAttribution();
  if (!attribution) return path;
  const params = new URLSearchParams();
  for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "gbraid", "wbraid"]) {
    if (attribution[key]) params.set(key, attribution[key]);
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

const features = [
  { icon: MessageSquare, title: "Real-Time Creator Messaging", text: "Direct and group messaging built for artists, producers, and collaborators." },
  { icon: FileAudio, title: "Audio & Voice Note Sharing", text: "Share high-resolution audio, files, and voice notes without leaving the conversation." },
  { icon: Music, title: "Built-In Music Studio", text: "Move from chat into Studio workflows for music creation, collaboration, and production." },
  { icon: Sparkles, title: "AI-Assisted Music Tools", text: "Use AI-assisted creator tools to support production, tagging, mastering, and music workflows." },
];

export default function MusicCollaborationLanding() {
  // Capture synchronously so first-render CTA hrefs retain ad parameters.
  captureMarketingAttribution();

  useEffect(() => {
    const previousTitle = document.title;
    const description = "Real-time creator messaging, audio sharing, music collaboration, a built-in Studio, and AI-assisted music tools. Start free with NaliChat.";
    document.title = "Music Collaboration & Creator Messaging | NaliChat";
    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") || null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", description);
    return () => {
      document.title = previousTitle;
      if (previousDescription === null) meta?.remove();
      else meta?.setAttribute("content", previousDescription);
    };
  }, []);

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-[max(4rem,env(safe-area-inset-top))] sm:px-6 sm:pb-20">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">NaliChat for music creators</p>
          <h1 className="font-heading text-4xl font-black tracking-tight sm:text-6xl">
            Creator Messaging & Music Collaboration in One Workspace
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-foreground/80 sm:text-xl">
            Message artists in real time, share audio and voice notes, collaborate on music, and move into a built-in Studio when you are ready to create.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-12 w-full rounded-xl px-7 font-semibold sm:w-auto">
              <Link to={attributedPath("/register")}>
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-12 w-full rounded-xl px-7 font-semibold sm:w-auto">
              <Link to={attributedPath("/pricing")}>Compare Plans</Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Core chat is free forever · No paid plan required to start
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {features.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-border/70 bg-card/60 p-6">
              <Icon className="h-7 w-7 text-primary" />
              <h2 className="mt-4 text-xl font-bold">{title}</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">{text}</p>
            </article>
          ))}
        </div>

        <section className="mt-10 rounded-3xl border border-border/70 bg-card/50 p-6 text-center sm:p-8">
          <ShieldCheck className="mx-auto h-7 w-7 text-primary" />
          <h2 className="mt-3 text-2xl font-bold">Built for creator collaboration</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Start with messaging, then use NaliChat's collaboration, file-sharing, Studio, and creator tools as your workflow grows.
          </p>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
          <Link to="/">Home</Link>
          <Link to="/pricing">Plans</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <a href="mailto:support@nalichat.org">Contact Support</a>
        </footer>
      </section>
    </main>
  );
}
