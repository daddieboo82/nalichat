import { useNavigate } from "react-router-dom";
import { Mic2, Users, Image, Film, FolderOpen, BarChart3, Rocket, MessageCircle, Sparkles, ArrowRight, Star, Store, Globe, Radio, Swords, FlaskConical, SlidersHorizontal } from "lucide-react";
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
  return <div className="h-full overflow-y-auto bg-[#080810] px-4 pb-24 pt-6 text-white">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="overflow-hidden rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-cyan-500/10 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.25em] text-fuchsia-300"><Sparkles size={16}/> Nali Artist Career OS</div>
        <h1 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">One command center for the entire artist journey.</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/65">Create the record, collaborate, finish the assets, build the campaign, release it, connect with your audience and learn from the results without losing the creative thread.</p>
        <Button className="mt-5" onClick={() => navigate("/artist-release-center")}><Rocket size={17} className="mr-2"/>Open Release Center</Button>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([name, description, route, Icon], index) => <button key={name} onClick={() => navigate("/"+route)} className="group rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left transition hover:border-fuchsia-400/50 hover:bg-white/[.07]">
          <div className="flex items-center justify-between"><span className="text-xs font-bold text-white/40">0{index+1}</span><Icon size={20} className="text-fuchsia-300"/></div>
          <h2 className="mt-5 text-lg font-black">{name}</h2><p className="mt-1 min-h-10 text-xs leading-relaxed text-white/55">{description}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-fuchsia-300">Enter <ArrowRight size={13}/></span>
        </button>)}
      </section>
      <section className="rounded-3xl border border-white/10 bg-white/[.03] p-5">
        <h2 className="text-lg font-black">Artist &amp; studio experiences</h2>
        <p className="mt-1 text-xs text-white/50">Open any experience directly from here.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {experiences.map(([name, route, Icon]) => (
            <button key={route} onClick={() => navigate(route)} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-left text-sm font-bold transition hover:border-fuchsia-400/50 hover:bg-white/[.07]">
              <Icon size={16} className="shrink-0 text-fuchsia-300" />
              <span className="min-w-0">{name}</span>
              <ArrowRight size={13} className="ml-auto shrink-0 text-white/40" />
            </button>
          ))}
        </div>
      </section>
    </div>
  </div>;
}