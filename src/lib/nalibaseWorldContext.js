export const WORLD_CONTEXTS = Object.freeze({
  connect: { label: 'CONNECT', name: 'NaliChat World', path: '/world/connect', glow: 'from-pink-500/25 via-fuchsia-500/5 to-transparent' },
  create: { label: 'CREATE', name: 'NaliStudio World', path: '/world/create', glow: 'from-cyan-500/25 via-blue-500/5 to-transparent' },
  discover: { label: 'DISCOVER', name: 'Creator World', path: '/world/discover', glow: 'from-violet-500/25 via-fuchsia-500/5 to-transparent' },
  share: { label: 'SHARE', name: 'Project World', path: '/world/share', glow: 'from-emerald-500/25 via-teal-500/5 to-transparent' },
  visualize: { label: 'VISUALIZE', name: 'Visual World', path: '/world/visualize', glow: 'from-orange-500/25 via-rose-500/5 to-transparent' },
  compete: { label: 'COMPETE', name: 'Arena World', path: '/world/compete', glow: 'from-yellow-500/25 via-amber-500/5 to-transparent' },
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

export function getWorldForPath(pathname='') {
  const direct = pathname.match(/^\/world\/([^/]+)/)?.[1];
  if (direct && WORLD_CONTEXTS[direct]) return { id: direct, ...WORLD_CONTEXTS[direct] };
  const match = PATH_WORLD.find(([pattern]) => pattern.test(pathname));
  return match ? { id: match[1], ...WORLD_CONTEXTS[match[1]] } : null;
}
