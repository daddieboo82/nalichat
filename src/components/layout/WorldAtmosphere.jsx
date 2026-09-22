import { useLocation } from 'react-router-dom';
import { getWorldForPath } from '@/lib/nalibaseWorldContext';

export default function WorldAtmosphere() {
  const { pathname } = useLocation();
  const world = getWorldForPath(pathname);
  if (!world || pathname.startsWith('/world/')) return null;
  return <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
    <div className={'absolute inset-0 bg-gradient-to-br ' + world.glow + ' opacity-60'} />
    <div className="absolute inset-0 opacity-[.12] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
    <div className="absolute -right-48 top-20 h-[34rem] w-[34rem] rounded-full bg-white/[.035] blur-3xl" />
  </div>;
}
