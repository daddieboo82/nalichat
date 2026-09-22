import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Building2, Store } from 'lucide-react';
import { getWorldForPath } from '@/lib/nalibaseWorldContext';

const seen = new Set();
export default function StorefrontEntryTransition() {
  const location = useLocation();
  const { pathname } = location;
  const world = getWorldForPath(pathname, location.state?.fromWorld);
  const [visible,setVisible]=useState(false);
  useEffect(()=>{
    if (!world || pathname.startsWith('/world/') || seen.has(`${world.id}:${pathname}`)) return;
    seen.add(`${world.id}:${pathname}`); setVisible(true);
    const t=setTimeout(()=>setVisible(false),720);
    return()=>clearTimeout(t);
  },[pathname,world?.id]);
  return <AnimatePresence>{visible&&world&&<motion.div className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center bg-black/90 backdrop-blur-xl" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}}>
    <motion.div initial={{scale:.86,y:20,opacity:0}} animate={{scale:1,y:0,opacity:1}} exit={{scale:1.05,opacity:0}} className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><Store className="h-8 w-8"/></div>
      <p className="mt-5 text-[10px] font-black uppercase tracking-[.3em] text-white/45">{world.label} MALL</p>
      <h2 className="mt-2 font-heading text-3xl font-black sm:text-5xl">Entering storefront</h2>
      <div className="mx-auto mt-5 flex items-center justify-center gap-2 text-xs text-white/45"><Building2 className="h-4 w-4"/>{world.name}</div>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}
