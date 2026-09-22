import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Music, Sparkles, FileAudio, MessageSquare, ArrowRight, ShieldCheck } from "lucide-react";
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
  { icon: Music, title: "Built-In Music Studio", text: "Move from creator conversation into Studio workflows for music creation and production." },
  { icon: Sparkles, title: "AI-Assisted Music Tools", text: "Use AI-assisted creator tools to support production, tagging, mastering, and music workflows." },
  { icon: FileAudio, title: "Audio & File Workflow", text: "Keep project audio and files connected to the people and conversations behind the work." },
  { icon: MessageSquare, title: "Creator Messaging Included", text: "Talk through ideas in real time before moving them into your Studio workflow." },
];

export default function MusicStudioLanding() {
  captureMarketingAttribution();

  useEffect(() => {
    const previousTitle = document.title;
    const description = "Built-in music Studio workflows, AI-assisted creator tools, audio sharing, files, and real-time creator messaging. Start free with NaliBase.";
    document.title = "Music Studio for Creators | NaliBase";
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
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-primary">NaliBase · CREATE world</p>
          <h1 className="font-heading text-4xl font-black tracking-tight sm:text-6xl">Music Studio & AI-Assisted Tools for Creators</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-foreground/80 sm:text-xl">
            Keep creator messaging, audio, files, Studio workflows, and AI-assisted music tools connected in one workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-12 w-full rounded-xl px-7 font-semibold sm:w-auto">
              <Link to={attributedPath("/register")}>Start Free <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="min-h-12 w-full rounded-xl px-7 font-semibold sm:w-auto">
              <Link to={attributedPath("/pricing")}>Compare Plans</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Core chat is free forever · No paid plan required to start</p>
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
          <h2 className="mt-3 text-2xl font-bold">From conversation to creation</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Start with messaging, then move ideas, audio, files, and creator workflows into NaliBase's CREATE-world Studio experience.</p>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-sm text-muted-foreground">
          <Link to="/">Home</Link><Link to="/pricing">Plans</Link><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><a href="mailto:support@nalichat.org">Contact Support</a>
        </footer>
      </section>
    </main>
  );
}
