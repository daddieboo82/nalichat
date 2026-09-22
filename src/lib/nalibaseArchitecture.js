export const NALIBASE_ARCHITECTURE = Object.freeze({
  destination: 'NaliBase',
  hubRole: 'central_plaza',
  worldRole: 'mall',
  featureRole: 'storefront',
  experienceRole: 'inside_store',
  hierarchy: Object.freeze(['NaliBase', 'World Mall', 'Storefront', 'Experience']),
  worlds: Object.freeze({
    connect: ['Messages', 'Creator Network', 'Your Profile', 'Collaboration Projects'],
    create: ['NaliStudio', 'Quick Record', 'Cover Art Lab', 'Playlists'],
    discover: ['Explore', 'Playlists', 'Leaderboard', 'Creator Analytics'],
    share: ['File Vault', 'Projects', 'Messages', 'Studio Import'],
    visualize: ['Music Video Lab', 'Cover Art Lab', 'Studio', 'Explore'],
    compete: ['Challenge Arena', 'Leaderboards', 'Create a Challenge', 'Squads'],
  }),
});
