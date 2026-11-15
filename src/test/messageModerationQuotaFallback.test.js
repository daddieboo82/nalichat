import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const paths = [
  'base44/functions/sendConversationMessage/entry.ts',
  'base44/functions/mutateConversationMessage/entry.ts',
];

describe('message moderation integration-quota fallback', () => {
  for (const path of paths) {
    it(`${path} uses functional regex word boundaries`, () => {
      const source = readFileSync(path, 'utf8');
      const match = source.match(/const highRisk = (\/[^\n]+\/i);/);
      expect(match).not.toBeNull();
      const expression = match[1];
      expect(expression).toContain(String.raw`\b`);
      expect(expression).not.toContain(String.raw`\\b`);
      const regex = new Function(`return ${expression}`)();
      expect(regex.test('I will kill you')).toBe(true);
      expect(regex.test('I want to shoot you')).toBe(true);
      expect(regex.test('Can you send the song mix?')).toBe(false);
      expect(regex.test('skills in the studio')).toBe(false);
    });
  }
});
