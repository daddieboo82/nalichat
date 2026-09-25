import { useNavigate } from 'react-router-dom';
import { Mic2, Users, Image, Film, FolderOpen, BarChart3, Rocket, MessageCircle, Sparkles, ArrowRight } from 'lucide-react';

const stages = [
  ['Create', 'Write, record and produce the next record.', '/studio', Mic2],
  ['Collaborate', 'Move ideas, stems and decisions between your team.', '/messages', Users],
  ['Finish', 'Keep masters, stems and delivery files organized.', '/files', FolderOpen],
  ['Artwork', 'Build the visual identity for the release.', '/cover-art', Image],
  ['Video', 'Turn the song into an editable music video.', '/music-video-generator', Film],
  ['Campaign', 'Prepare the release and promotion plan.', '/artist-release-center', Rocket],
  ['Community', 'Reach collaborators, listeners and supporters.', '/explore', MessageCircle],
  ['Analyze', 'Learn what is working and plan the next move.', '/analytics', BarChart3],
];

export default function ArtistCareerOS() {
  const navigate = useNavigate();
  return <div className="min-h-full overflow-y-auto bg-[#080810] px-4 pb-24 pt-6 text-white">
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-cyan-500/10 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[.25em] text-fuchsia-300"><Sparkles size={16}/> Nali Artist Career OS</div>
        <h1 className="mt-3 max-w-3xl text-3xl font-black sm:text-5xl">One command center for the entire artist journey.</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/65">Create, collaborate, finish, launch, engage and learn without losing the creative thread.</p>
        <button onClick={() => navigate('/artist-release-center')} className="mt-5 rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-black">Open Release Center</button>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map(([name, description, path, Icon], index) => (
          <button key={name} onClick={() => navigate(path)} className="group rounded-2xl border border-white/10 bg-white/[.04] p-4 text-left hover:border-fuchsia-400/50 hover:bg-white/[.07]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white/40">0{index + 1}</span>
              <Icon size={20} className="text-fuchsia-300"/>
            </div>
            <h2 className="mt-5 text-lg font-black">{name}</h2>
            <p className="mt-1 min-h-10 text-xs leading-relaxed text-white/55">{description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-fuchsia-300">Enter <ArrowRight size={13}/></span>
          </button>
        ))}
      </section>
    </div>
  </div>;
}
