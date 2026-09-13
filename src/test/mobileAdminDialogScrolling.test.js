// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('mobile admin and dialog scrolling', () => {
  it('uses native touch scrolling in long maintenance and dialog lists', async () => {
    const files = [
      'src/components/admin/NaliMaintenancePanel.jsx',
      'src/components/explore/TrackCommentsDialog.jsx',
      'src/components/messages/FollowUpReminderDialog.jsx',
      'src/components/messages/ViralMomentDialog.jsx',
      'src/pages/AdminDashboard.jsx',
    ];
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      expect(source).toContain('[-webkit-overflow-scrolling:touch]');
    }
  });
});
