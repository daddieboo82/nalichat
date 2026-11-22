import { useNavigate } from "react-router-dom";
import { Mic2, Users, Image, Film, FolderOpen, BarChart3, Rocket, MessageCircle, ArrowRight, Star, Store, Globe, Radio, Swords, FlaskConical, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";

const stages = [
  ["Create", "Write, record and produce the next record.", "studio", Mic2],
  ["Collaborate", "Move ideas, stems and decisions between your team.", "messages", Users],
  ["Finish", "Keep masters, stems and delivery files organized.", "files", FolderOpen],
  ["Artwork", "Build the visual identity for the release.", "cover-art", Image],
  ["Video", "Turn the song into an editable music video.", "music-video-generator", Film],
  ["Campaign", "Prepare the release and promotion plan.", "artist-release-center", Rocket],
  ["Community", "Reach collaborators, listeners and supporters.", "explore", MessageCircle],
  ["Analyze", "Learn what is working and plan the next move.", "analytics", BarChart3],
];

const experiences = [
  ["Artist World", "/artist-world", Globe],
  ["Backstage", "/artist-backstage", Star],
  ["AI Creative Director", "/artist-creative-director", Image],
  ["Artist Marketplace", "/artist-marketplace", Store],
  ["Collaboration Rooms", "/collaboration-rooms", Users],
  ["Live Studio Sessions", "/live-studio-sessions", Radio],
  ["Release War Room", "/release-war-room", Swords],
  ["Song Feedback Lab", "/song-feedback-lab", FlaskConical],
  ["Studio Editor", "/studio-editor", SlidersHorizontal],
];

export default function ArtistCareerOS() {
  const navigate = useNavigate();
  return <div className="h-full overflow-y-auto bg-background px-4 pb-24 pt-6 text-foreground">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary/15 via-card/60 to-accent/10 p-6 sm:p-8">
        <h1 className="mt-3 max-w-3xl font-heading text-3xl font-black tracking-tight sm:text-5xl">Artist Career OS</h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">Choose a tool for your next release.</p>
        <Button className="mt-5 min-h-12 rounded-xl px-5 font-semibold" onClick={() => navigate("/artist-release-center")}><Rocket size={17} className="mr-2"/>Open Release Center</Button>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([name, description, route, Icon]) => <button key={name} onClick={() => navigate("/"+route)} className="ui-surface ui-hover group min-h-12 rounded-2xl p-4 text-left transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between"><Icon size={20} className="text-primary" aria-hidden="true" /><ArrowRight size={16} className="text-muted-foreground" aria-hidden="true" /></div>
          <h2 className="mt-5 font-heading text-lg font-black">{name}</h2><p className="mt-1 min-h-10 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </button>)}
      </section>
      <section className="ui-surface rounded-3xl p-5">
        <h2 className="font-heading text-lg font-black">Artist &amp; studio experiences</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {experiences.map(([name, route, Icon]) => (
            <button key={route} onClick={() => navigate(route)} className="flex min-h-12 items-center gap-3 rounded-xl border border-border/70 bg-secondary/40 px-4 py-3 text-left text-sm font-bold transition-colors hover:border-primary/40 hover:bg-secondary/70">
              <Icon size={16} className="shrink-0 text-primary" />
              <span className="min-w-0">{name}</span>
              <ArrowRight size={13} className="ml-auto shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    </div>
  </div>;
}