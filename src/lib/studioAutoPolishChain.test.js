import { describe, expect, it, vi } from 'vitest';
import { connectTrackChain } from './audioProcessing';

function mockContext() {
  const created = { filters: [], compressors: [], gains: [] };
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const context = {
    createGain: () => {
      const gain = { ...node(), gain: { value: 1 } };
      created.gains.push(gain);
      return gain;
    },
    createBiquadFilter: () => {
      const filter = { ...node(), frequency: { value: 0 }, Q: { value: 0 } };
      created.filters.push(filter);
      return filter;
    },
    createDynamicsCompressor: () => {
      const compressor = {
        ...node(), threshold: { value: 0 }, knee: { value: 0 },
        ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
      };
      created.compressors.push(compressor);
      return compressor;
    },
  };
  return { context, created };
}

describe('Studio Auto Polish signal chain', () => {
  it('inserts gentle rumble reduction and compression for a flagged vocal', () => {
    const { context, created } = mockContext();
    const source = { connect: vi.fn() };
    const destination = { connect: vi.fn() };
    connectTrackChain(context, source, { name: 'Vocal', autoPolish: true }, { destination });
    expect(created.filters).toHaveLength(1);
    expect(created.filters[0].type).toBe('highpass');
    expect(created.filters[0].frequency.value).toBe(70);
    expect(created.compressors).toHaveLength(1);
    expect(created.compressors[0].ratio.value).toBe(2.5);
    expect(created.compressors[0].threshold.value).toBe(-20);
  });

  it('does not add Auto Polish processing when the toggle is off', () => {
    const { context, created } = mockContext();
    connectTrackChain(context, { connect: vi.fn() }, { name: 'Vocal', autoPolish: false });
    expect(created.filters).toHaveLength(0);
    expect(created.compressors).toHaveLength(0);
  });

  it('uses the same Auto Polish graph in offline bounce mode', () => {
    const { context, created } = mockContext();
    context.startRendering = vi.fn();
    connectTrackChain(context, { connect: vi.fn() }, {
      name: 'Singing Take', autoPolish: true, volume: 75,
    });
    expect(created.filters).toHaveLength(1);
    expect(created.compressors).toHaveLength(1);
  });
});
