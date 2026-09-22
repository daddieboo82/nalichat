export const WORLD_CONTEXTS = Object.freeze({
  connect: { label: 'CONNECT', name: 'NaliChat World', path: '/world/connect', plazaGradient: 'from-primary/35 to-pink-500/15', storefronts: [{label:'Messages',path:'/messages'},{label:'Creator Network',path:'/explore'},{label:'Profile',path:'/profile'},{label:'Projects',path:'/projects-summary'}], glow: 'from-pink-500/25 via-fuchsia-500/5 to-transparent' },
  create: { label: 'CREATE', name: 'NaliStudio World', path: '/world/create', plazaGradient: 'from-cyan-500/30 to-accent/15', storefronts: [{label:'Studio',path:'/studio'},{label:'Quick Record',path:'/record'},{label:'Cover Art',path:'/cover-art'},{label:'Playlists',path:'/playlists'}], glow: 'from-cyan-500/25 via-blue-500/5 to-transparent' },
  discover: { label: 'DISCOVER', name: 'Creator World', path: '/world/discover', plazaGradient: 'from-violet-500/30 to-fuchsia-500/15', storefronts: [{label:'Explore',path:'/explore'},{label:'Playlists',path:'/playlists'},{label:'Leaderboard',path:'/leaderboard'},{label:'Analytics',path:'/analytics'}], glow: 'from-violet-500/25 via-fuchsia-500/5 to-transparent' },
  share: { label: 'SHARE', name: 'Project World', path: '/world/share', plazaGradient: 'from-emerald-500/30 to-teal-500/15', storefronts: [{label:'File Vault',path:'/files'},{label:'Projects',path:'/projects-summary'},{label:'Messages',path:'/messages'},{label:'Studio Import',path:'/studio'}], glow: 'from-emerald-500/25 via-teal-500/5 to-transparent' },
  visualize: { label: 'VISUALIZE', name: 'Visual World', path: '/world/visualize', plazaGradient: 'from-orange-500/30 to-rose-500/15', storefronts: [{label:'Video Lab',path:'/music-video-generator'},{label:'Cover Art',path:'/cover-art'},{label:'Studio',path:'/studio'},{label:'Explore',path:'/explore'}], glow: 'from-orange-500/25 via-rose-500/5 to-transparent' },
  compete: { label: 'COMPETE', name: 'Arena World', path: '/world/compete', plazaGradient: 'from-yellow-500/30 to-amber-500/15', storefronts: [{label:'Challenges',path:'/challenges'},{label:'Leaderboard',path:'/leaderboard'},{label:'Create Challenge',path:'/create-challenge'},{label:'Squads',path:'/squad'}], glow: 'from-yellow-500/25 via-amber-500/5 to-transparent' },
});

const PATH_WORLD = [
  [/^\/messages(?:\/|$)/, 'connect'], [/^\/profile(?:\/|$)/, 'connect'],
  [/^\/studio(?:\/|$)/, 'create'], [/^\/record(?:\/|$)/, 'create'],
  [/^\/cover-art(?:\/|$)/, 'visualize'], [/^\/music-video-generator(?:\/|$)/, 'visualize'],
  [/^\/files(?:\/|$)/, 'share'], [/^\/projects-summary(?:\/|$)/, 'share'],
  [/^\/challenges(?:\/|$)/, 'compete'], [/^\/challenge(?:\/|$)/, 'compete'],
  [/^\/create-challenge(?:\/|$)/, 'compete'], [/^\/squad(?:\/|$)/, 'compete'],
  [/^\/leaderboard(?:\/|$)/, 'compete'], [/^\/analytics(?:\/|$)/, 'discover'],
  [/^\/explore(?:\/|$)/, 'discover'], [/^\/playlists(?:\/|$)/, 'discover'], [/^\/playlist(?:\/|$)/, 'discover'],
];

export function getWorldForPath(pathname='', preferredWorld='') {
  if (preferredWorld && WORLD_CONTEXTS[preferredWorld]) {
    const storefrontMatch = WORLD_CONTEXTS[preferredWorld].storefronts.some(({path}) => pathname === path || pathname.startsWith(path + '/'));
    if (storefrontMatch) return { id: preferredWorld, ...WORLD_CONTEXTS[preferredWorld] };
  }
  const direct = pathname.match(/^\/world\/([^/]+)/)?.[1];
  if (direct && WORLD_CONTEXTS[direct]) return { id: direct, ...WORLD_CONTEXTS[direct] };
  const match = PATH_WORLD.find(([pattern]) => pattern.test(pathname));
  return match ? { id: match[1], ...WORLD_CONTEXTS[match[1]] } : null;
}

const WORLD_SESSION_KEY = 'nalibase.activeWorld';
const WORLD_VISIT_KEY = 'nalibase.lastWorld';

const visitKeyFor = (userId='') => `${WORLD_VISIT_KEY}:${userId || 'anonymous'}`;

export function rememberWorldContext(worldId='', userId='') {
  if (typeof window === 'undefined' || !WORLD_CONTEXTS[worldId]) return;
  try {
    window.sessionStorage.setItem(WORLD_SESSION_KEY, worldId);
    window.sessionStorage.setItem(visitKeyFor(userId), worldId);
  } catch (_) {}
}

export function getLastVisitedWorld(userId='') {
  if (typeof window === 'undefined') return null;
  try {
    const worldId = window.sessionStorage.getItem(visitKeyFor(userId)) || '';
    return WORLD_CONTEXTS[worldId] ? { id: worldId, ...WORLD_CONTEXTS[worldId] } : null;
  } catch (_) { return null; }
}

export function clearActiveWorldContext() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(WORLD_SESSION_KEY); } catch (_) {}
}

export function getRememberedWorldForPath(pathname='') {
  if (typeof window === 'undefined') return '';
  try {
    const worldId = window.sessionStorage.getItem(WORLD_SESSION_KEY) || '';
    if (!WORLD_CONTEXTS[worldId]) return '';
    const matches = WORLD_CONTEXTS[worldId].storefronts.some(({path}) => pathname === path || pathname.startsWith(path + '/'));
    return matches ? worldId : '';
  } catch (_) { return ''; }
}

export function resolveWorldForLocation(pathname='', stateWorld='') {
  const preferred = stateWorld || getRememberedWorldForPath(pathname);
  const world = getWorldForPath(pathname, preferred);
  // Keep shared-storefront mall continuity separate from account-scoped visit history.
  // Explicit navigation state may update the active mall, but only entering WorldHub
  // should count as a recently visited world.
  if (stateWorld && world?.id === stateWorld && typeof window !== 'undefined') {
    try { window.sessionStorage.setItem(WORLD_SESSION_KEY, stateWorld); } catch (_) {}
  }
  return world;
}
