export const NALIBASE_GROWTH_BOUNDARY = Object.freeze({
  root: 'nalibase',
  mode: 'in_product_only',
  cadence: 'one_subtle_enhancement_at_a_time',
  allowedWorlds: Object.freeze(['connect', 'create', 'discover', 'share', 'visualize', 'compete']),
  externalExpansionRequiresExplicitUserAuthorization: true,
  autonomousExternalExpansion: false,
});

export function isNaliBaseWorld(worldId) {
  return NALIBASE_GROWTH_BOUNDARY.allowedWorlds.includes(String(worldId || '').toLowerCase());
}
