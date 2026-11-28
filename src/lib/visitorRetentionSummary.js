// Engagement events are cumulative snapshots, not independent visits.
// Keep only the longest observed foreground duration per client session.
const round = value => Math.round(value * 10) / 10;
const normalize = value => typeof value === 'string' && value.trim() ? value.trim() : 'Unknown';

export function summarizeVisitorRetention(events = []) {
  const sessions = new Map();
  for (const event of events) {
    if (event?.event_name !== 'product_session_engagement') continue;
    const properties = event.metadata || {};
    const key = properties.product_session_id || event.session_id;
    if (properties.engaged_seconds == null) continue;
    const seconds = Number(properties.engaged_seconds);
    const checkpoint = ['heartbeat', 'early_checkpoint'].includes(properties.reason);
    if (!key || !Number.isFinite(seconds) || seconds < 0) continue;
    const old = sessions.get(key);
    if (old && (old.seconds > seconds || (old.seconds === seconds && (!old.checkpoint || checkpoint)))) continue;
    sessions.set(key, {
      seconds,
      checkpoint,
      landing: normalize(properties.landing_path),
      source: normalize(event.campaign_source || properties.campaign_source),
      // Historical records without a device category remain unknown.
      device: normalize(properties.device_type),
    });
  }
  const rows = [...sessions.values()].filter(row => !row.checkpoint);
  const checkpointOnly = sessions.size - rows.length;
  const summary = input => {
    if (!input.length) return { sessions: 0, median: null, average: null, under10: null, under10Count: 0 };
    const durations = input.map(row => row.seconds).sort((a, b) => a - b);
    const middle = Math.floor(durations.length / 2);
    const median = durations.length % 2 ? durations[middle] : (durations[middle - 1] + durations[middle]) / 2;
    const under10Count = durations.filter(s => s < 10).length;
    return { sessions: durations.length, median: round(median), average: round(durations.reduce((sum, s) => sum + s, 0) / durations.length), under10: Math.round(100 * under10Count / durations.length), under10Count };
  };
  const groups = field => {
    const buckets = new Map();
    for (const row of rows) {
      const label = row[field];
      if (!buckets.has(label)) buckets.set(label, []);
      buckets.get(label).push(row);
    }
    return [...buckets.entries()].map(([label, entries]) => ({ label, ...summary(entries) }))
      .sort((a, b) => b.sessions - a.sessions).slice(0, 8);
  };
  const observed = summary([...sessions.values()]);
  return { ...summary(rows), observed, checkpointOnly, byLanding: groups('landing'), bySource: groups('source'), byDevice: groups('device') };
}
