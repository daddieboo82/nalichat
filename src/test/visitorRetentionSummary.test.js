import { describe, it, expect } from 'vitest';
import { summarizeVisitorRetention } from '@/lib/visitorRetentionSummary';
const event = (id, seconds, landing = '/', source = 'direct') => ({
  event_name: 'product_session_engagement', session_id: id, campaign_source: source,
  metadata: { engaged_seconds: seconds, landing_path: landing, product_session_id: id },
});
describe('visitor retention summary', () => {
  it('deduplicates cumulative engagement and reports the longest recorded time per session', () => {
    const data = [event('a', 2), event('a', 12), event('b', 8, '/register', 'google.com'), event('a', 7), event('c', 40, '/register')];
    const result = summarizeVisitorRetention(data);
    expect(result).toMatchObject({ sessions: 3, median: 12, average: 20, under10: 33, under10Count: 1 });
    expect(result.byLanding.find(r => r.label === '/register')).toMatchObject({sessions: 2, median: 24});
    expect(result.bySource.find(r => r.label === 'google.com')).toMatchObject({sessions: 1, median: 8});
  });
  it('rejects invalid or missing session data and keeps missing values unmeasured', () => {
    const result = summarizeVisitorRetention([{event_name: 'product_session_engagement',metadata:{engaged_seconds: 9}}, event('bad', -2), {event_name: 'homepage_view'}]);
    expect(result).toMatchObject({sessions:0,median:null,average:null,under10:null});
  });
  it('does not infer device from missing funnel metadata', () => {
    const result = summarizeVisitorRetention([event('a', 9)]);
    expect(result.byDevice).toMatchObject([{label:'Unknown',sessions:1}]);
  });
});
