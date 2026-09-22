export const WORLD_CONTEXTS = Object.freeze({
  connect: { label: 'CONNECT', name: 'NaliChat World', path: '/world/connect', storefronts: [{label:'Messages',path:'/messages'},{label:'Creator Network',path:'/explore'},{label:'Profile',path:'/profile'},{label:'Projects',path:'/projects-summary'}], glow: 'from-pink-500/25 via-fuchsia-500/5 to-transparent' },
  create: { label: 'CREATE', name: 'NaliStudio World', path: '/world/create', storefronts: [{label:'Studio',path:'/studio'},{label:'Quick Record',path:'/record'},{label:'Cover Art',path:'/cover-art'},{label:'Playlists',path:'/playlists'}], glow: 'from-cyan-500/25 via-blue-500/5 to-transparent' },
  discover: { label: 'DISCOVER', name: 'Creator World', path: '/world/discover', storefronts: [{label:'Explore',path:'/explore'},{label:'Playlists',path:'/playlists'},{label:'Leaderboard',path:'/leaderboard'},{label:'Analytics',path:'/analytics'}], glow: 'from-violet-500/25 via-fuchsia-500/5 to-transparent' },
  share: { label: 'SHARE', name: 'Project World', path: '/world/share', storefronts: [{label:'File Vault',path:'/files'},{label:'Projects',path:'/projects-summary'},{label:'Messages',path:'/messages'},{label:'Studio Import',path:'/studio'}], glow: 'from-emerald-500/25 via-teal-500/5 to-transparent' },
  visualize: { label: 'VISUALIZE', name: 'Visual World', path: '/world/visualize', storefronts: [{label:'Video Lab',path:'/music-video-generator'},{label:'Cover Art',path:'/cover-art'},{label:'Studio',path:'/studio'},{label:'Explore',path:'/explore'}], glow: 'from-orange-500/25 via-rose-500/5 to-transparent' },
  compete: { label: 'COMPETE', name: 'Arena World', path: '/world/compete', storefronts: [{label:'Challenges',path:'/challenges'},{label:'Leaderboard',path:'/leaderboard'},{label:'Create Challenge',path:'/create-challenge'},{label:'Squads',path:'/squad'}], glow: 'from-yellow-500/25 via-amber-500/5 to-transparent' },
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

export function rememberWorldContext(worldId='') {
  if (typeof window === 'undefined' || !WORLD_CONTEXTS[worldId]) return;
  try {
    window.sessionStorage.setItem(WORLD_SESSION_KEY, worldId);
    window.sessionStorage.setItem(WORLD_VISIT_KEY, worldId);
  } catch (_) {}
}

export function getLastVisitedWorld() {
  if (typeof window === 'undefined') return null;
  try {
    const worldId = window.sessionStorage.getItem(WORLD_VISIT_KEY) || '';
    return WORLD_CONTEXTS[worldId] ? { id: worldId, ...WORLD_CONTEXTS[worldId] } : null;
  } catch (_) { return null; }
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
  if (stateWorld && world?.id === stateWorld) rememberWorldContext(stateWorld);
  return world;
}
