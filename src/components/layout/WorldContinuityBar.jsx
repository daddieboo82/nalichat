import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, Home } from 'lucide-react';
import { getWorldForPath } from '@/lib/nalibaseWorldContext';

export default function WorldContinuityBar() {
  const { pathname } = useLocation();
  const world = getWorldForPath(pathname);
  if (!world || pathname.startsWith('/world/')) return null;
  return <div className="relative z-30 shrink-0 border-b border-white/[0.07] bg-black/80 px-3 py-2 backdrop-blur-xl">
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
      <Link to={world.path} className="group flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-bold text-white/70 transition hover:bg-white/[.06] hover:text-white">
        <ArrowLeft className="h-3.5 w-3.5 shrink-0"/><Building2 className="h-3.5 w-3.5 shrink-0"/>
        <span className="truncate">{world.label} Mall</span><span className="hidden font-medium text-white/35 sm:inline">· storefront interior</span>
      </Link>
      <Link to="/" className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[.04] px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:text-white"><Home className="h-3.5 w-3.5"/>NaliBase</Link>
    </div>
    <div className={`pointer-events-none absolute inset-x-0 top-full h-12 bg-gradient-to-b ${world.glow}`}/>
  </div>;
}
