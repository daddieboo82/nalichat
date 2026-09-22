import { WORLD_CONTEXTS, WORLD_ORDER } from './nalibaseWorldContext.js';

const architectureWorlds = Object.freeze(Object.fromEntries(
  WORLD_ORDER.map((id) => [id, Object.freeze(WORLD_CONTEXTS[id].storefronts.map(({ label }) => label))])
));

export const NALIBASE_ARCHITECTURE = Object.freeze({
  destination: 'NaliBase',
  hubRole: 'central_plaza',
  worldRole: 'mall',
  featureRole: 'storefront',
  experienceRole: 'inside_store',
  hierarchy: Object.freeze(['NaliBase', 'World Mall', 'Storefront', 'Experience']),
  worlds: architectureWorlds,
});
