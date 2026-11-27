// Mixer animation runs on every transport frame. Effects objects are shared
// between automation projections until the user edits the plugin rack. Avoid
// repeated serialization when the configuration reference is unchanged.
export function studioFxStructureChanged(previous, next) {
  if (!previous) return true;
  if (!!previous.autoPolish !== !!next?.autoPolish) return true;
  const before = previous.effects || previous.plugins || null;
  const after = next?.effects || next?.plugins || null;
  if (before === after) return false;
  return JSON.stringify(before || {}) !== JSON.stringify(after || {});
}
