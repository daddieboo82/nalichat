// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('NaliBase AI growth boundary', () => {
  it('keeps both Nali agents inside the NaliBase product boundary', async () => {
    for (const path of ['base44/agents/studio_ai.jsonc', 'base44/agents/studio_ai_plus.jsonc']) {
      const agent = JSON.parse(await read(path));
      expect(agent.instructions).toContain('NALIBASE GROWTH BOUNDARY — HARD RULE');
      expect(agent.instructions).toContain('permanent root boundary');
      expect(agent.instructions).toContain('Never autonomously create, launch, publish, provision, or operate an external website');
      expect(agent.instructions).toContain('one subtle, reversible in-product enhancement at a time');
      expect(agent.instructions).toContain('New concepts belong as NaliBase worlds, districts, or capabilities');
    }
  });

  it('defines the six authorized product-growth worlds and requires authorization for external expansion', async () => {
    const source = await read('src/lib/nalibaseGrowthBoundary.js');
    for (const world of ['connect','create','discover','share','visualize','compete']) expect(source).toContain(`'${world}'`);
    expect(source).toContain('autonomousExternalExpansion: false');
    expect(source).toContain('externalExpansionRequiresExplicitUserAuthorization: true');
    expect(source).toContain("cadence: 'one_subtle_enhancement_at_a_time'");
  });
});
