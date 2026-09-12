import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

describe('lifecycle entity id validation', () => {
  it('base44/functions/deleteChallenge/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/deleteChallenge/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(challengeId.trim())');
    expect(source.indexOf('isBase44EntityId(challengeId.trim())')).toBeLessThan(source.indexOf('entities.Challenge.get(challengeId)'));
  });

  it('base44/functions/updateChallengeStatus/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/updateChallengeStatus/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(challengeId.trim())');
    expect(source.indexOf('isBase44EntityId(challengeId.trim())')).toBeLessThan(source.indexOf('entities.Challenge.get(challengeId)'));
  });

  it('base44/functions/deleteChallengeSubmission/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/deleteChallengeSubmission/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(submissionId.trim())');
    expect(source.indexOf('isBase44EntityId(submissionId.trim())')).toBeLessThan(source.indexOf('entities.ChallengeSubmission.get(submissionId)'));
  });

  it('base44/functions/deleteTrackVersion/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/deleteTrackVersion/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(versionId.trim())');
    expect(source.indexOf('isBase44EntityId(versionId.trim())')).toBeLessThan(source.indexOf('entities.TrackVersion.get(versionId)'));
  });

  it('base44/functions/mutateTrack/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/mutateTrack/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(trackId)');
    expect(source.indexOf('isBase44EntityId(trackId)')).toBeLessThan(source.indexOf('entities.Track.get(trackId)'));
  });

  it('base44/functions/deleteFolder/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/deleteFolder/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(folderId.trim())');
    expect(source.indexOf('isBase44EntityId(folderId.trim())')).toBeLessThan(source.indexOf('entities.Folder.get(folderId)'));
  });

  it('base44/functions/mutateMilestone/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/mutateMilestone/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(milestoneId)');
    expect(source.indexOf('isBase44EntityId(milestoneId)')).toBeLessThan(source.indexOf('entities.Milestone.get(milestoneId)'));
  });

  it('base44/functions/mutateSharedFile/entry.ts validates ids before privileged reads', async () => {
    const source = await readFile('base44/functions/mutateSharedFile/entry.ts', 'utf8');
    expect(source).toContain('isBase44EntityId(fileId)');
    expect(source.indexOf('isBase44EntityId(fileId)')).toBeLessThan(source.indexOf('entities.SharedFile.get(fileId)'));
  });

});
