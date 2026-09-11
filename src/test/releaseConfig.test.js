// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
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


  it('keeps Nali AI tiered and free of privileged admin tools', async () => {
    const standardAgent = await readJson('base44/agents/studio_ai.jsonc');
    const plusAgent = await readJson('base44/agents/studio_ai_plus.jsonc');

    expect(standardAgent.model).toBeUndefined();
    expect(plusAgent.model).toBe('claude_opus_4_8');

    const standardFunctions = (standardAgent.tool_configs || [])
      .map((tool) => tool.function_name)
      .filter(Boolean);
    const standardEntities = (standardAgent.tool_configs || [])
      .map((tool) => tool.entity_name)
      .filter(Boolean);

    expect(standardFunctions).not.toContain('makeAdmin');
    expect(standardFunctions).not.toContain('createSubscriptionCheckout');
    expect(standardFunctions).not.toContain('moderateContent');
    expect(standardEntities).not.toContain('Subscription');
    expect(standardEntities).not.toContain('Violation');
    expect(standardEntities).not.toContain('Notification');
  });


  it('separates artist profession from authorization role', async () => {
    const user = await readJson('base44/entities/User.jsonc');
    expect(user.properties.artist_role).toBeTruthy();
    expect(user.properties.role.default).toBe('user');
    expect(user.properties.role.rls?.write?.user_condition?.role).toBe('admin');
  });


  it('keeps costly AI media and legacy export signing behind server gates', async () => {
    const speech = await readText('base44/functions/generate-speech/entry.ts');
    const mastering = await readText('base44/functions/bounceAndMaster/entry.ts');
    const signer = await readText('base44/functions/get-studio-export-url/entry.ts');

    expect(speech).toContain("requireEntitlement");
    expect(speech).toContain("'ai.standard'");
    expect(mastering).toContain("requireEntitlement");
    expect(mastering).toContain("'ai.standard'");
    expect(signer).toContain("user.role !== 'admin'");
  });

  it('builds SMS invite links on the server instead of trusting client URLs', async () => {
    const smsInvite = await readText('base44/functions/sendSmsInvite/entry.ts');
    expect(smsInvite).toContain("X-Base44-App-Url");
    expect(smsInvite).toContain("/register");
    expect(smsInvite).not.toContain("const { phone, link }");
  });


  it('keeps workflow notifications authoritative and idempotent', async () => {
    const messageNotify = await readText('base44/functions/notifyOnMessage/entry.ts');
    const fileNotify = await readText('base44/functions/notifyOnFileUpload/entry.ts');
    const commentNotify = await readText('base44/functions/notifyOnTrackComment/entry.ts');
    const versionNotify = await readText('base44/functions/notifyOnTrackVersion/entry.ts');
    const milestoneNotify = await readText('base44/functions/notifyOnMilestoneUpdate/entry.ts');
    const legacyNotify = await readText('base44/functions/onNewContent/entry.ts');

    for (const source of [messageNotify, fileNotify, commentNotify, versionNotify, milestoneNotify]) {
      expect(source).toContain('data?.id');
      expect(source).toContain('Notification.create');
      expect(source).toContain('notification_');
    }
    expect(messageNotify).toContain('entities.Message.get(data.id)');
    expect(fileNotify).toContain('entities.SharedFile.get(data.id)');
    expect(commentNotify).toContain('entities.TrackComment.get(data.id)');
    expect(versionNotify).toContain('entities.TrackVersion.get(data.id)');
    expect(milestoneNotify).toContain('entities.Milestone.get(data.id)');
    expect(legacyNotify).toContain('legacy_noop: true');
    expect(legacyNotify).not.toContain('Notification.create');
  });


  it('preserves collaboration integrity when deleting an account', async () => {
    const deletion = await readText('base44/functions/deleteMyAccount/entry.ts');

    expect(deletion).toContain('const successor = editors.find');
    expect(deletion).toContain("['TrackVersion', 'Track', 'SharedFile', 'Folder', 'Milestone']");
    expect(deletion).toContain("creator_name: 'Deleted User'");
    expect(deletion).toContain("author_name: 'Deleted User'");
    expect(deletion).toContain("ChallengeVote.filter({ voter_id: user.id })");
    expect(deletion).toContain("actorNotifications");
    expect(deletion).toContain("editor_ids: editorIds");
    expect(deletion).toContain("edit_user_ids: remainingEditors");
  });


  it('rate-limits costly outbound and AI actions on the server', async () => {
    const limitedPaths = [
      'base44/functions/sendSmsInvite/entry.ts',
      'base44/functions/send-invite-email/entry.ts',
      'base44/functions/sendExternalMessage/entry.ts',
      'base44/functions/generate-speech/entry.ts',
      'base44/functions/generateViralConcepts/entry.ts',
      'base44/functions/aiMasterSession/entry.ts',
      'base44/functions/generate-cover-art/entry.ts',
      'base44/functions/generate-viral-moment/entry.ts',
      'base44/functions/generateArtistBio/entry.ts',
      'base44/functions/bounceAndMaster/entry.ts',
      'base44/functions/transcribeMessageAudio/entry.ts',
    ];

    for (const path of limitedPaths) {
      const source = await readText(path);
      expect(source).toContain('consumeHourlyLimit');
      expect(source).toContain('status: 429');
    }

    const limiter = await readText('base44/shared/rateLimit.ts');
    expect(limiter).toContain('count: { $lt: limit }');
    expect(limiter).toContain('Number(update?.updated || 0) > 0');
  });


  it('keeps ArtPost views server-counted and challenge submissions immutable by entrants', async () => {
    const artPost = await readJson('base44/entities/ArtPost.jsonc');
    const submission = await readJson('base44/entities/ChallengeSubmission.jsonc');
    const viewFunction = await readText('base44/functions/recordArtPostView/entry.ts');

    expect(artPost.properties.views.rls?.write?.user_condition?.role).toBe('admin');
    expect(viewFunction).toContain('consumeHourlyLimit');
    expect(viewFunction).toContain('$inc: { views: 1 }');
    expect(submission.rls.update?.user_condition?.role).toBe('admin');
  });


  it('requires challenge submissions to pass the server challenge window checks', async () => {
    const submission = await readJson('base44/entities/ChallengeSubmission.jsonc');
    const submitFunction = await readText('base44/functions/submitChallengeRemix/entry.ts');

    expect(submission.rls.create?.user_condition?.role).toBe('admin');
    expect(submitFunction).toContain("challenge.status !== 'active'");
    expect(submitFunction).toContain('submission_end_date');
    expect(submitFunction).toContain('100 * 1024 * 1024');
    expect(submitFunction).toContain('producer_id: user.id');
  });


  it('creates challenges through validated server policy with immutable host identity', async () => {
    const challenge = await readJson('base44/entities/Challenge.jsonc');
    const createChallenge = await readText('base44/functions/createChallenge/entry.ts');

    expect(challenge.rls.create?.user_condition?.role).toBe('admin');
    expect(challenge.properties.host_artist_id.rls?.write?.user_condition?.role).toBe('admin');
    expect(challenge.properties.host_artist_name.rls?.write?.user_condition?.role).toBe('admin');
    expect(createChallenge).toContain('Submission deadline must be after the start date');
    expect(createChallenge).toContain('Voting deadline must be after the submission deadline');
    expect(createChallenge).toContain('host_artist_id: user.id');
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
