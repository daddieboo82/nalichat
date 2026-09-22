import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MessageSquare, Music, Compass, FolderKanban, Video, Trophy, Users, UserPlus, Radio, Mic, Wand2, ListMusic, BarChart3, FolderOpen, Upload, Images, Film, Swords, Medal, Rocket, UserRound } from 'lucide-react';
import { trackProductEvent } from '@/lib/productAnalytics';

const worlds = {
  connect: {
    eyebrow: 'NaliChat World', title: 'CONNECT', tagline: 'Your people. Your conversations. Your creative network.',
    glow: 'from-pink-500/30 via-primary/10 to-transparent', icon: MessageSquare,
    districts: [
      ['Messages','DMs, group conversations and real-time collaboration.','/messages',MessageSquare],
      ['Creator Network','Discover creators and build your circle.','/explore',Users],
      ['Your Profile','Show the world who you are and what you make.','/profile',UserRound],
      ['Collaboration Projects','Keep shared creative work moving.','/projects-summary',UserPlus],
    ]
  },
  create: {
    eyebrow: 'NaliStudio World', title: 'CREATE', tagline: 'A complete creative district for turning an idea into a release.',
    glow: 'from-cyan-500/30 via-blue-500/10 to-transparent', icon: Music,
    districts: [
      ['NaliStudio','Record, arrange, edit and mix your music.','/studio',Music],
      ['Quick Record','Capture an idea before it disappears.','/record',Mic],
      ['Cover Art Lab','Create artwork for your next release.','/cover-art',Wand2],
      ['Playlists','Organize music and build collections.','/playlists',ListMusic],
    ]
  },
  discover: {
    eyebrow: 'Creator World', title: 'DISCOVER', tagline: 'A living discovery world for music, creators and momentum.',
    glow: 'from-violet-500/30 via-fuchsia-500/10 to-transparent', icon: Compass,
    districts: [
      ['Explore','Browse tracks, creators and what is happening now.','/explore',Compass],
      ['Playlists','Move through curated collections and sounds.','/playlists',ListMusic],
      ['Leaderboard','See creators building momentum.','/leaderboard',Medal],
      ['Creator Analytics','Understand your own reach and growth.','/analytics',BarChart3],
    ]
  },
  share: {
    eyebrow: 'Project World', title: 'SHARE', tagline: 'The exchange layer for files, projects and creative handoffs.',
    glow: 'from-emerald-500/30 via-teal-500/10 to-transparent', icon: FolderKanban,
    districts: [
      ['File Vault','Access shared files and creative assets.','/files',FolderOpen],
      ['Projects','Organize collaborations around the work.','/projects-summary',FolderKanban],
      ['Messages','Send context with every handoff.','/messages',MessageSquare],
      ['Studio Import','Bring shared material straight into creation.','/studio',Upload],
    ]
  },
  visualize: {
    eyebrow: 'Visual World', title: 'VISUALIZE', tagline: 'Give the music a face, a scene and a visual identity.',
    glow: 'from-orange-500/30 via-rose-500/10 to-transparent', icon: Video,
    districts: [
      ['Music Video Lab','Build visual concepts and music-video experiences.','/music-video-generator',Film],
      ['Cover Art Lab','Shape the visual identity of a release.','/cover-art',Images],
      ['Studio','Return to the sound that drives the visual.','/studio',Music],
      ['Explore','See what other creators are releasing.','/explore',Compass],
    ]
  },
  compete: {
    eyebrow: 'Arena World', title: 'COMPETE', tagline: 'Challenges, rankings and discovery built around creative momentum.',
    glow: 'from-yellow-500/30 via-amber-500/10 to-transparent', icon: Trophy,
    districts: [
      ['Challenge Arena','Enter live creative challenges.','/challenges',Swords],
      ['Leaderboards','Track rankings and standout creators.','/leaderboard',Trophy],
      ['Create a Challenge','Launch a competition for the community.','/create-challenge',Rocket],
      ['Squads','Build a team and compete together.','/squad',Users],
    ]
  },
};

export default function WorldHub() {
  const { worldId } = useParams();
  const world = worlds[worldId];
  if (!world) return <Navigate to="/" replace />;
  const WorldIcon = world.icon;
  return (
    <main className="relative min-h-[100dvh] overflow-hidden px-4 pb-24 pt-24 sm:px-6 lg:px-8">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-gradient-to-b ${world.glow} blur-3xl`} />
      <div className="relative mx-auto max-w-6xl">
        <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-muted-foreground backdrop-blur-xl transition hover:text-foreground"><ArrowLeft className="h-4 w-4"/>NaliBase</Link>
        <section className="py-12 text-center sm:py-16">
          <motion.div initial={{scale:.9,opacity:0}} animate={{scale:1,opacity:1}} className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/15 bg-white/5 shadow-2xl backdrop-blur-xl"><WorldIcon className="h-9 w-9"/></motion.div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[.3em] text-primary">{world.eyebrow}</p>
          <h1 className="mt-2 font-heading text-5xl font-black tracking-tight sm:text-7xl">{world.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">{world.tagline}</p>
        </section>
        <section>
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-muted-foreground">World map</p><h2 className="mt-1 font-heading text-2xl font-black">Choose a district</h2></div><span className="hidden text-xs text-muted-foreground sm:block">Everything here belongs to {world.title}</span></div>
          <div className="grid gap-4 md:grid-cols-2">
            {world.districts.map(([name,description,path,Icon],index)=>(
              <motion.div key={name} initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:index*.06}} whileHover={{y:-4}}>
                <Link to={path} onClick={()=>trackProductEvent('post_login_action',{source:`${worldId}_world`,action:`open_${name.toLowerCase().replace(/\s+/g,'_')}`})} className="group flex min-h-40 items-stretch overflow-hidden rounded-3xl border border-white/10 bg-card/60 p-5 shadow-xl backdrop-blur-xl transition hover:border-white/25 hover:bg-card/80">
                  <div className="flex w-full flex-col"><div className="flex items-start justify-between"><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5"><Icon className="h-6 w-6"/></div><ArrowRight className="h-5 w-5 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-foreground"/></div><div className="mt-auto pt-5"><h3 className="font-heading text-xl font-black">{name}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
        <section className="mt-10 rounded-3xl border border-white/10 bg-black/20 p-6 text-center backdrop-blur-xl"><p className="text-xs font-bold uppercase tracking-[.24em] text-primary">NaliBase Portal</p><h2 className="mt-2 font-heading text-2xl font-black">Move between worlds without leaving your creative identity.</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">Your profile, projects and creative momentum travel with you across NaliBase.</p><Link to="/" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground">Return to NaliBase <ArrowRight className="h-4 w-4"/></Link></section>
      </div>
    </main>
  );
}
