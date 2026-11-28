import { describe, it, expect, vi } from 'vitest';
import { releaseStudioAudioPlayer } from './studioAudioPlayerRelease';
const fixture = () => {
  const player = { pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() };
  return { player, players: { 7: player }, starting: new Map([[7, {}], ['7', {}], [8, {}]]), failed: new Set([7, '7', 8]), engine: { detach: vi.fn() } };
};
describe('releaseStudioAudioPlayer', () => {
  it.each([7, '7'])('releases both typed IDs, source and graph for %s', id => {
    const f = fixture();
    expect(releaseStudioAudioPlayer({...f,id})).toBe(true);
    expect(f.players[7]).toBeUndefined();
    expect([...f.starting.keys()]).toEqual([8]);
    expect([...f.failed]).toEqual([8]);
    expect(f.engine.detach).toHaveBeenCalledWith(7);
    expect(f.engine.detach).toHaveBeenCalledWith('7');
    expect(f.player.pause).toHaveBeenCalledOnce();
    expect(f.player.removeAttribute).toHaveBeenCalledWith('src');
    expect(f.player.load).toHaveBeenCalledOnce();
    expect(releaseStudioAudioPlayer({...f,id})).toBe(false);
  });
  it('ignores stale replacement callbacks', () => {
    const f = fixture();
    expect(releaseStudioAudioPlayer({...f,id:7,expected:{}})).toBe(false);
    expect(f.players[7]).toBe(f.player);
    expect(f.player.pause).not.toHaveBeenCalled();
  });
  it('invalidates callbacks before media release and continues after exceptions', () => {
    const f = fixture();
    f.engine.detach.mockImplementation(() => { expect(f.players[7]).toBeUndefined(); throw Error('detached'); });
    f.player.pause.mockImplementation(() => { throw Error('paused'); });
    expect(releaseStudioAudioPlayer({...f,id:7})).toBe(true);
    expect(f.player.load).toHaveBeenCalledOnce();
  });
});
