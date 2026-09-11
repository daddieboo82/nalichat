// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
}

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

describe('release configuration', () => {
  it('targets the current Android API required by the release pipeline', async () => {
    const manifest = await readJson('src/twa-manifest.json');
    expect(manifest.packageId).toBe('com.nalichat');
    expect(manifest.host).toBe('nalichat.org');
    expect(manifest.targetSdkVersion).toBeGreaterThanOrEqual(36);
  });

  it('ships a non-empty Digital Asset Links certificate fingerprint', async () => {
    const assetLinks = await readJson('public/.well-known/assetlinks.json');
    const target = assetLinks.find((entry) => entry?.target?.package_name === 'com.nalichat')?.target;
    expect(target).toBeTruthy();
    expect(target.sha256_cert_fingerprints).toEqual(
      expect.arrayContaining([expect.stringMatching(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)]),
    );
  });

  it('keeps Stripe checkout lease fields as first-class User properties', async () => {
    const userSchema = await readJson('base44/entities/User.jsonc');
    expect(userSchema.properties.trial_claim_id).toBeTruthy();
    expect(userSchema.properties.stripe_checkout_claim_id).toBeTruthy();
    expect(userSchema.properties.stripe_checkout_claimed_at).toBeTruthy();
    expect(userSchema.properties.trial_claim_id.stripe_checkout_claim_id).toBeUndefined();
  });

  it('does not expose Studio tracks or shared files through globally-open RLS', async () => {
    const track = await readJson('base44/entities/Track.jsonc');
    const version = await readJson('base44/entities/TrackVersion.jsonc');
    const sharedFile = await readJson('base44/entities/SharedFile.jsonc');
    const folder = await readJson('base44/entities/Folder.jsonc');

    expect(track.properties.access_user_ids).toBeTruthy();
    expect(version.properties.access_user_ids).toBeTruthy();
    expect(sharedFile.properties.access_user_ids).toBeTruthy();
    expect(folder.properties.access_user_ids).toBeTruthy();
    expect(track.properties.edit_user_ids).toBeTruthy();
    expect(version.properties.edit_user_ids).toBeTruthy();
    expect(sharedFile.properties.edit_user_ids).toBeTruthy();
    expect(folder.properties.edit_user_ids).toBeTruthy();
    expect(track.rls.read).not.toBeNull();
    expect(version.rls.read).not.toBeNull();
    expect(sharedFile.rls.read).not.toBeNull();
    expect(folder.rls.read).not.toBeNull();
    expect(JSON.stringify(track.rls.update)).toContain('edit_user_ids');
    expect(JSON.stringify(version.rls.update)).toContain('edit_user_ids');
    expect(JSON.stringify(sharedFile.rls.update)).toContain('edit_user_ids');
    expect(JSON.stringify(folder.rls.update)).toContain('edit_user_ids');
  });


  it('keeps conversation, voting, notification, and comment mutations server-authoritative', async () => {
    const conversation = await readJson('base44/entities/Conversation.jsonc');
    const vote = await readJson('base44/entities/ChallengeVote.jsonc');
    const notification = await readJson('base44/entities/Notification.jsonc');
    const comment = await readJson('base44/entities/TrackComment.jsonc');

    expect(conversation.properties.is_public).toBeTruthy();
    expect(conversation.rls.update?.user_condition?.role).toBe('admin');
    expect(conversation.rls.delete?.user_condition?.role).toBe('admin');
    expect(vote.rls.create?.user_condition?.role).toBe('admin');
    expect(notification.rls.create?.user_condition?.role).toBe('admin');
    expect(comment.rls.create?.user_condition?.role).toBe('admin');
    expect(comment.rls.read?.user_condition?.role).toBe('admin');
  });

  it('protects collaboration role fields from editor self-escalation', async () => {
    const project = await readJson('base44/entities/Project.jsonc');
    for (const field of ['owner_id', 'collaborator_ids', 'collaborator_roles', 'editor_ids']) {
      expect(project.properties[field]?.rls?.write).toBeTruthy();
    }

    for (const path of [
      'base44/entities/Track.jsonc',
      'base44/entities/TrackVersion.jsonc',
      'base44/entities/Folder.jsonc',
      'base44/entities/Milestone.jsonc',
      'base44/entities/SharedFile.jsonc',
    ]) {
      const schema = await readJson(path);
      for (const field of ['access_user_ids', 'edit_user_ids']) {
        if (schema.properties[field]) {
          expect(schema.properties[field].rls?.write?.user_condition?.role).toBe('admin');
        }
      }
    }
  });

  it('protects challenge vote totals and moderation status from submitter writes', async () => {
    const submission = await readJson('base44/entities/ChallengeSubmission.jsonc');
    expect(submission.properties.vote_count.rls?.write?.user_condition?.role).toBe('admin');
    expect(submission.properties.status.rls?.write?.user_condition?.role).toBe('admin');
  });


  it('keeps challenge submissions and voting server-authoritative', async () => {
    const submission = await readJson('base44/entities/ChallengeSubmission.jsonc');
    expect(submission.rls.create?.user_condition?.role).toBe('admin');
    expect(JSON.stringify(submission.rls.read)).toContain('approved');

    const submitFn = await readText('base44/functions/submitChallengeRemix/entry.ts');
    expect(submitFn).toContain("challenge.status !== 'active'");
    expect(submitFn).toContain('submission_end_date');
    expect(submitFn).toContain('MAX_REMIX_BYTES');
    expect(submitFn).toContain('trustedUploadUrl');

    const submitUi = await readText('src/components/challenges/SubmitRemixModal.jsx');
    expect(submitUi).toContain('MAX_REMIX_BYTES');
    expect(submitUi).toContain('submitChallengeRemix');
    expect(submitUi).not.toContain('ChallengeSubmission.create');

    const castVote = await readText('base44/functions/castVote/entry.ts');
    expect(castVote).toContain('voting_end_date');
    expect(castVote).toContain('Voting has ended for this challenge.');

    const comments = await readText('base44/functions/trackComments/entry.ts');
    expect(comments).toContain("parent.status === 'approved'");
  });

  it('keeps the PWA manifest scoped to the serving origin', async () => {
    const manifest = await readJson('public/manifest.json');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    for (const shortcut of manifest.shortcuts || []) {
      expect(shortcut.url).toMatch(/^\//);
    }
  });
});
