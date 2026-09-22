import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, Home, Store } from 'lucide-react';
import { getWorldForPath } from '@/lib/nalibaseWorldContext';

export default function WorldContinuityBar() {
  const location = useLocation();
  const { pathname } = location;
  const world = getWorldForPath(pathname, location.state?.fromWorld);
  if (!world || pathname.startsWith('/world/')) return null;
  const siblings = world.storefronts || [];
  return <div className="relative z-30 shrink-0 border-b border-white/[0.07] bg-black/80 px-3 py-2 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center gap-2">
      <Link to={world.path} className="group flex min-w-0 shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/[.06] hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5"/><Building2 className="h-3.5 w-3.5"/><span>{world.label} Mall</span><span className="hidden text-white/30 lg:inline">· storefront interior</span>
      </Link>
      <div className="hidden h-5 w-px bg-white/10 sm:block"/>
      <nav aria-label={`${world.label} storefronts`} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {siblings.map(item => <Link key={item.path} to={item.path} state={{fromWorld:world.id}} className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition ${pathname===item.path?'bg-white/10 text-white':'text-white/40 hover:bg-white/[.05] hover:text-white/75'}`}><Store className="h-3 w-3"/>{item.label}</Link>)}
      </nav>
      <Link to="/" className="ml-auto flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:text-white"><Home className="h-3.5 w-3.5"/><span className="hidden sm:inline">NaliBase </span>Plaza</Link>
    </div>
    <div className={`pointer-events-none absolute inset-x-0 top-full h-12 bg-gradient-to-b ${world.glow}`}/>
  </div>;
}
