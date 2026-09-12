// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

const files = [
  'src/lib/NaliPresenceContext.jsx',
  'src/components/AiAssistant.jsx',
  'src/components/navigation/DesktopNav.jsx',
  'src/components/navigation/MobileHeader.jsx',
  'src/components/notifications/NotificationBell.jsx',
  'src/pages/ChallengeDetail.jsx',
  'src/pages/SubmissionPlayer.jsx',
];

describe('shared UI auth context', () => {
  for (const path of files) {
    it(`${path} avoids duplicate auth.me resolution`, async () => {
      const source = await readText(path);
      expect(source).toContain('useAuth');
      expect(source).not.toContain('base44.auth.me().then');
    });
  }
});
