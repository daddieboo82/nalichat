import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('studio/media entity id validation', () => {
  it('validates art-post play ids', async () => { const s=await readFile('base44/functions/recordArtPostPlay/entry.ts','utf8'); expect(s).toContain('isBase44EntityId(postId)'); });
  it('validates studio project rooms while preserving local studio', async () => { const s=await readFile('base44/functions/updateStudioPresence/entry.ts','utf8'); expect(s).toContain("roomId !== 'local_studio' && !isBase44EntityId(roomId)"); });
  it('validates challenge submission ids', async () => { const s=await readFile('base44/functions/submitChallengeRemix/entry.ts','utf8'); expect(s).toContain('!isBase44EntityId(challengeId)'); });
  it('validates track/version project ids', async () => { const s=await readFile('base44/functions/createTrackVersion/entry.ts','utf8'); expect(s).toContain('!isBase44EntityId(body.track_id.trim())'); expect(s).toContain('!isBase44EntityId(body.project_id.trim())'); });
});
