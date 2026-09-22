import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, MessageSquare, Music, Compass, FolderKanban, Video, Trophy, Users, UserPlus, Mic, Wand2, ListMusic, BarChart3, FolderOpen, Upload, Images, Film, Swords, Medal, Rocket, UserRound, Map, Sparkles, Store, Building2 } from 'lucide-react';
import { trackProductEvent } from '@/lib/productAnalytics';

const worlds = {
  connect: {
    eyebrow:'NaliChat World', title:'CONNECT', splash:'ENTER THE NETWORK', tagline:'Your people. Your conversations. Your creative network.',
    atmosphere:'A neon social metropolis where conversations, creators and collaborations are always moving.',
    glow:'from-pink-500/40 via-primary/15 to-transparent', orb:'from-pink-500 via-fuchsia-500 to-violet-700', icon:MessageSquare,
    landmarks:['Signal Tower','Creator Boulevard','Collab Plaza','Profile Heights'],
    districts:[
      ['Messages','DMs, group conversations and real-time collaboration.','/messages',MessageSquare],
      ['Creator Network','Discover creators and build your circle.','/explore',Users],
      ['Your Profile','Show the world who you are and what you make.','/profile',UserRound],
      ['Collaboration Projects','Keep shared creative work moving.','/projects-summary',UserPlus],
    ]
  },
  create: {
    eyebrow:'NaliStudio World', title:'CREATE', splash:'ENTER THE STUDIO CITY', tagline:'A complete creative district for turning an idea into a release.',
    atmosphere:'A futuristic production city of recording rooms, sound labs, artwork stations and release tools.',
    glow:'from-cyan-500/40 via-blue-500/15 to-transparent', orb:'from-cyan-400 via-blue-500 to-indigo-700', icon:Music,
    landmarks:['Studio Core','Sound Lab','Art District','Playlist Terminal'],
    districts:[
      ['NaliStudio','Record, arrange, edit and mix your music.','/studio',Music],
      ['Quick Record','Capture an idea before it disappears.','/record',Mic],
      ['Cover Art Lab','Create artwork for your next release.','/cover-art',Wand2],
      ['Playlists','Organize music and build collections.','/playlists',ListMusic],
    ]
  },
  discover: {
    eyebrow:'Creator World', title:'DISCOVER', splash:'ENTER THE DISCOVERY GRID', tagline:'A living discovery world for music, creators and momentum.',
    atmosphere:'An endless discovery grid where new music, rising creators and cultural signals surface in real time.',
    glow:'from-violet-500/40 via-fuchsia-500/15 to-transparent', orb:'from-violet-500 via-fuchsia-500 to-purple-800', icon:Compass,
    landmarks:['Discovery Grid','Sound Trails','Momentum Tower','Insight Observatory'],
    districts:[
      ['Explore','Browse tracks, creators and what is happening now.','/explore',Compass],
      ['Playlists','Move through curated collections and sounds.','/playlists',ListMusic],
      ['Leaderboard','See creators building momentum.','/leaderboard',Medal],
      ['Creator Analytics','Understand your own reach and growth.','/analytics',BarChart3],
    ]
  },
  share: {
    eyebrow:'Project World', title:'SHARE', splash:'ENTER THE EXCHANGE', tagline:'The exchange layer for files, projects and creative handoffs.',
    atmosphere:'A secure logistics world for moving massive creative assets, projects and ideas between collaborators.',
    glow:'from-emerald-500/40 via-teal-500/15 to-transparent', orb:'from-emerald-400 via-teal-500 to-cyan-800', icon:FolderKanban,
    landmarks:['File Vault','Project Dock','Transfer Bridge','Import Terminal'],
    districts:[
      ['File Vault','Access shared files and creative assets.','/files',FolderOpen],
      ['Projects','Organize collaborations around the work.','/projects-summary',FolderKanban],
      ['Messages','Send context with every handoff.','/messages',MessageSquare],
      ['Studio Import','Bring shared material straight into creation.','/studio',Upload],
    ]
  },
  visualize: {
    eyebrow:'Visual World', title:'VISUALIZE', splash:'ENTER THE VISUAL REALM', tagline:'Give the music a face, a scene and a visual identity.',
    atmosphere:'A cinematic realm of moving light, virtual sets, artwork labs and visual storytelling.',
    glow:'from-orange-500/40 via-rose-500/15 to-transparent', orb:'from-orange-400 via-rose-500 to-red-800', icon:Video,
    landmarks:['Cinema Core','Cover Gallery','Scene Forge','Inspiration Deck'],
    districts:[
      ['Music Video Lab','Build visual concepts and music-video experiences.','/music-video-generator',Film],
      ['Cover Art Lab','Shape the visual identity of a release.','/cover-art',Images],
      ['Studio','Return to the sound that drives the visual.','/studio',Music],
      ['Explore','See what other creators are releasing.','/explore',Compass],
    ]
  },
  compete: {
    eyebrow:'Arena World', title:'COMPETE', splash:'ENTER THE ARENA', tagline:'Challenges, rankings and discovery built around creative momentum.',
    atmosphere:'A massive competitive arena where creators enter challenges, form squads and rise through the ranks.',
    glow:'from-yellow-500/40 via-amber-500/15 to-transparent', orb:'from-yellow-300 via-amber-500 to-orange-800', icon:Trophy,
    landmarks:['Challenge Arena','Rank Tower','Squad Grounds','Victory Hall'],
    districts:[
      ['Challenge Arena','Enter live creative challenges.','/challenges',Swords],
      ['Leaderboards','Track rankings and standout creators.','/leaderboard',Trophy],
      ['Create a Challenge','Launch a competition for the community.','/create-challenge',Rocket],
      ['Squads','Build a team and compete together.','/squad',Users],
    ]
  },
};

function WorldSplash({world,onComplete}) {
  const Icon=world.icon;
  useEffect(()=>{ const t=setTimeout(onComplete,2200); return()=>clearTimeout(t); },[onComplete]);
  return <motion.div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black" initial={{opacity:1}} exit={{opacity:0,scale:1.05}} transition={{duration:.55}}>
    <div className={`absolute inset-0 bg-gradient-to-br ${world.glow}`} />
    <motion.div className={`absolute h-[65vmax] w-[65vmax] rounded-full bg-gradient-to-br ${world.orb} opacity-20 blur-[90px]`} initial={{scale:.4}} animate={{scale:1.1,rotate:25}} transition={{duration:2.1,ease:'easeOut'}}/>
    <div className="relative text-center">
      <motion.div initial={{scale:.35,opacity:0,rotate:-20}} animate={{scale:1,opacity:1,rotate:0}} transition={{type:'spring',duration:1}} className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2.5rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl"><Icon className="h-14 w-14"/></motion.div>
      <motion.p initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.35}} className="mt-8 text-xs font-black uppercase tracking-[.45em] text-white/60">NaliBase Portal</motion.p>
      <motion.h1 initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} transition={{delay:.5}} className="mt-3 font-heading text-5xl font-black tracking-tight sm:text-8xl">{world.title}</motion.h1>
      <motion.p initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.8}} className="mt-4 text-sm font-bold uppercase tracking-[.25em] text-white/70">{world.splash}</motion.p>
      <motion.div className="mx-auto mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full bg-white" initial={{x:'-100%'}} animate={{x:'0%'}} transition={{duration:1.8,ease:'easeInOut'}}/></motion.div>
    </div>
  </motion.div>
}

export default function WorldHub(){
  const {worldId}=useParams(); const world=worlds[worldId]; const [splash,setSplash]=useState(true);
  const finishSplash=useCallback(()=>setSplash(false),[]);
  useEffect(()=>setSplash(true),[worldId]);
  if(!world) return <Navigate to="/" replace/>;
  const WorldIcon=world.icon;
  return <>
    <AnimatePresence>{splash&&<WorldSplash key={worldId} world={world} onComplete={finishSplash}/>}</AnimatePresence>
    <main className="relative min-h-[100dvh] overflow-hidden bg-black px-4 pb-28 pt-20 sm:px-6 lg:px-8">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-b ${world.glow}`}/>
      <div className="pointer-events-none absolute inset-0 opacity-40 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"/>
      <motion.div className={`pointer-events-none absolute left-1/2 top-40 h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br ${world.orb} opacity-15 blur-[120px]`} animate={{scale:[1,1.12,1],rotate:[0,15,0]}} transition={{duration:14,repeat:Infinity}}/>
      <div className="relative mx-auto max-w-7xl">
        <div className="flex items-center justify-between"><Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70 backdrop-blur-xl hover:text-white"><ArrowLeft className="h-4 w-4"/>NaliBase Hub</Link><span className="hidden text-xs font-bold uppercase tracking-[.2em] text-white/40 sm:block">Mall open · {world.title}</span></div>
        <section className="relative flex min-h-[72vh] items-center justify-center py-16 text-center">
          <div className="w-full">
            <motion.div initial={{scale:.8,opacity:0}} animate={{scale:1,opacity:1}} className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2.25rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl"><WorldIcon className="h-11 w-11"/></motion.div>
            <p className="mt-7 text-xs font-black uppercase tracking-[.34em] text-white/50">{world.eyebrow}</p>
            <h1 className="mt-3 font-heading text-6xl font-black tracking-[-.05em] sm:text-8xl lg:text-9xl">{world.title}</h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-white/75 sm:text-2xl">{world.tagline}</p>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/45 sm:text-base">{world.atmosphere}</p>
            <div className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-2 sm:grid-cols-4">{world.landmarks.map((x,i)=><motion.div key={x} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:.15+i*.08}} className="rounded-2xl border border-white/10 bg-white/[.04] p-4 backdrop-blur-xl"><Map className="mx-auto h-4 w-4 text-white/50"/><p className="mt-2 text-xs font-bold text-white/70">{x}</p></motion.div>)}</div>
          </div>
        </section>
        <section className="relative py-10 sm:py-16">
          <div className="mb-8"><div className="flex items-center gap-2 text-white/40"><Building2 className="h-4 w-4"/><p className="text-xs font-black uppercase tracking-[.28em]">Inside the mall</p></div><h2 className="mt-2 font-heading text-3xl font-black sm:text-5xl">Walk the concourse. Choose a storefront.</h2><p className="mt-3 max-w-2xl text-sm text-white/50">Every storefront opens into a complete NaliBase experience while keeping you connected to this world.</p></div>
          <div className="grid gap-5 md:grid-cols-2">{world.districts.map(([name,description,path,Icon],index)=><motion.div key={name} initial={{opacity:0,y:24}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{delay:index*.06}} whileHover={{y:-7,scale:1.01}}>
            <Link to={path} onClick={()=>trackProductEvent('post_login_action',{source:`${worldId}_world`,action:`open_${name.toLowerCase().replace(/\s+/g,'_')}`})} className="group relative flex min-h-64 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[.055] p-7 shadow-2xl backdrop-blur-2xl transition hover:border-white/25">
              <div className={`absolute -right-20 -top-20 h-64 w-64 rounded-full bg-gradient-to-br ${world.orb} opacity-10 blur-3xl transition group-hover:opacity-25`}/>
              <div className="relative z-10 flex w-full flex-col"><div className="flex items-start justify-between"><div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-black/30"><Icon className="h-7 w-7"/></div><ArrowRight className="h-6 w-6 text-white/35 transition group-hover:translate-x-2 group-hover:text-white"/></div><div className="mt-auto pt-12"><div className="flex items-center gap-2 text-white/35"><Store className="h-3.5 w-3.5"/><p className="text-[10px] font-black uppercase tracking-[.22em]">Storefront {String(index+1).padStart(2,'0')}</p></div><h3 className="mt-2 font-heading text-3xl font-black">{name}</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">{description}</p></div></div>
            </Link>
          </motion.div>)}</div>
        </section>
        <section className="mt-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[.04] p-8 text-center backdrop-blur-2xl sm:p-12"><Sparkles className="mx-auto h-7 w-7 text-white/60"/><p className="mt-4 text-xs font-black uppercase tracking-[.3em] text-white/40">NaliBase Portal Network</p><h2 className="mx-auto mt-3 max-w-3xl font-heading text-3xl font-black sm:text-5xl">This mall is one destination inside a much larger universe.</h2><p className="mx-auto mt-4 max-w-2xl text-sm text-white/55">Your identity, projects and creative momentum move with you. Return to the Hub whenever you want to enter another environment.</p><Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3 font-bold text-black">Return to NaliBase <ArrowRight className="h-4 w-4"/></Link></section>
      </div>
    </main>
  </>;
}
