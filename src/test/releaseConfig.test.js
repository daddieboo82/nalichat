// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { access, readFile, readdir } from 'node:fs/promises';

async function readText(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

describe('release configuration', () => {
  it('keeps workflow backend function references valid', async () => {
    const workflowDir = new URL('../../base44/workflows/', import.meta.url);
    const workflowFiles = (await readdir(workflowDir)).filter((name) => name.endsWith('.jsonc'));

    for (const name of workflowFiles) {
      const workflow = JSON.parse(await readFile(new URL(name, workflowDir), 'utf8'));
      for (const step of workflow?.definition?.do || []) {
        const functionName = step?.run_function?.with?.function_name;
        if (!functionName) continue;
        await expect(
          access(new URL(`../../base44/functions/${functionName}/entry.ts`, import.meta.url)),
        ).resolves.toBeUndefined();
      }
    }
  });

  it('protects scheduled bulk re-engagement with admin authorization', async () => {
    const reengage = await readText('base44/functions/reengageStalledUsers/entry.ts');
    expect(reengage).toContain("caller.role !== 'admin'");
    expect(reengage).toContain('Forbidden: admin role required');
  });

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

  it('derives project ownership on the server and protects owner identity', async () => {
    const project = await readJson('base44/entities/Project.jsonc');
    const createProject = await readText('base44/functions/createProject/entry.ts');
    const projectsPage = await readText('src/pages/ProjectsSummary.jsx');

    expect(project.rls.create?.user_condition?.role).toBe('admin');
    expect(project.properties.owner_id.rls?.write?.user_condition?.role).toBe('admin');
    expect(createProject).toContain('owner_id: user.id');
    expect(createProject).toContain('collaborator_ids: []');
    expect(projectsPage).not.toContain('entities.Project.create');
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

  it('routes challenge submission deletion through a cleanup-aware server function', async () => {
    const submission = await readJson('base44/entities/ChallengeSubmission.jsonc');
    const deletion = await readText('base44/functions/deleteChallengeSubmission/entry.ts');
    expect(submission.rls.delete?.user_condition?.role).toBe('admin');
    expect(deletion).toContain('entities.ChallengeVote.filter({ submission_id: submission.id })');
    expect(deletion).toContain("parent_type: 'challenge_submission'");
    expect(deletion).toContain('await entities.ChallengeSubmission.delete(submission.id)');
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


  it('uses artist_role for public profession filtering', async () => {
    const contacts = await readText('src/components/messages/ContactsTab.jsx');
    expect(contacts).toContain('u.artist_role ||');
    expect(contacts).not.toContain('u.role !== roleFilter');
  });


  it('separates artist profession from authorization role', async () => {
    const user = await readJson('base44/entities/User.jsonc');
    expect(user.properties.artist_role).toBeTruthy();
    expect(user.properties.role.default).toBe('user');
    expect(user.properties.role.rls?.write?.user_condition?.role).toBe('admin');
  });

  it('keeps onboarding re-engagement state server-managed', async () => {
    const user = await readJson('base44/entities/User.jsonc');
    expect(user.properties.reengagement_sent_at.rls?.write?.user_condition?.role).toBe('admin');
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

  it('validates legacy stored media hosts before server-side AI/transcription use', async () => {
    const mediaSecurity = await readText('base44/shared/mediaSecurity.ts');
    const transcription = await readText('base44/functions/transcribeMessageAudio/entry.ts');
    const viralMoment = await readText('base44/functions/generate-viral-moment/entry.ts');
    const coverArt = await readText('base44/functions/generate-cover-art/entry.ts');

    expect(mediaSecurity).toContain('isTrustedStoredMediaUrl');
    expect(transcription).toContain('isTrustedStoredMediaUrl(message.file_url)');
    expect(viralMoment).toContain('isTrustedStoredMediaUrl(message.file_url)');
    expect(coverArt).toContain('isTrustedStoredMediaUrl(file_url)');
  });

  it('builds invite links from server-configured origins only', async () => {
    const smsInvite = await readText('base44/functions/sendSmsInvite/entry.ts');
    const emailInvite = await readText('base44/functions/send-invite-email/entry.ts');
    const reengage = await readText('base44/functions/reengageStalledUsers/entry.ts');

    for (const source of [smsInvite, emailInvite, reengage]) {
      expect(source).toContain("Deno.env.get('APP_BASE_URL')");
      expect(source).not.toContain("req.headers.get('X-Base44-App-Url')");
    }
    expect(smsInvite).toContain("/register");
    expect(smsInvite).not.toContain("const { phone, link }");
  });


  it('derives outbound sender identity from the authenticated user', async () => {
    const externalMessage = await readText('base44/functions/sendExternalMessage/entry.ts');
    expect(externalMessage).not.toContain('senderName');
    expect(externalMessage).toContain("user.display_name || user.full_name");
  });


  it('keeps message attachments and thread references scoped to the active conversation', async () => {
    const sendMessage = await readText('base44/functions/sendConversationMessage/entry.ts');

    expect(sendMessage).toContain('Message attachment URL must use HTTPS');
    expect(sendMessage).toContain('Reply target is not in this conversation');
    expect(sendMessage).toContain('Thread target is not in this conversation');
    expect(sendMessage).toContain('replyTarget.conversation_id !== conversationId');
    expect(sendMessage).toContain('threadTarget.conversation_id !== conversationId');
    expect(sendMessage).toContain('conversation_id: conversationId');
    expect(sendMessage).not.toContain("'reply_to_text', 'reply_to_sender'");
  });

  it('supports video attachments end to end in the message schema and sender', async () => {
    const sendMessage = await readText('base44/functions/sendConversationMessage/entry.ts');
    const message = await readJson('base44/entities/Message.jsonc');
    expect(sendMessage).toContain("'video'");
    expect(sendMessage).toContain("['file', 'audio', 'image', 'video'].includes(type)");
    expect(message.properties.type.enum).toContain('video');
  });


  it('creates conversations only through validated server membership checks', async () => {
    const conversation = await readJson('base44/entities/Conversation.jsonc');
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');
    const messagesPage = await readText('src/pages/Messages.jsx');
    const globalMessage = await readText('src/components/GlobalMessageDialog.jsx');

    expect(conversation.rls.create?.user_condition?.role).toBe('admin');
    expect(manageConversation).toContain("action === 'create_dm' || action === 'create_group'");
    expect(manageConversation).toContain('Recipient not found');
    expect(manageConversation).toContain('One or more participants were not found');
    expect(messagesPage).not.toContain('entities.Conversation.create');
    expect(globalMessage).not.toContain('entities.Conversation.create');
  });

  it('does not expose public-room membership lists to nonmembers', async () => {
    const conversation = await readJson('base44/entities/Conversation.jsonc');
    const readRule = conversation.properties.participant_ids.rls?.read;
    expect(readRule?.$or).toBeTruthy();
    expect(readRule.$or).toEqual(expect.arrayContaining([
      expect.objectContaining({ 'data.participant_ids': '{{user.id}}' }),
      expect.objectContaining({ user_condition: { role: 'admin' } }),
    ]));
    expect(conversation.properties.participant_ids.rls?.write?.user_condition?.role).toBe('admin');
  });

  it('synchronizes message and typing read audiences when conversation membership changes', async () => {
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');
    expect(manageConversation).toContain('async function syncConversationAudience');
    expect(manageConversation).toContain('entities.Message.filter({ conversation_id: conversationId })');
    expect(manageConversation).toContain('entities.TypingStatus.filter({ conversation_id: conversationId })');
    expect(manageConversation).toContain('participant_ids: participantIds');
    expect(manageConversation.match(/syncConversationAudience\(entities, .*participantIds\)/g)?.length || 0).toBeGreaterThanOrEqual(3);
  });

  it('prunes departed users from message read receipts', async () => {
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');
    expect(manageConversation).toContain('read_by: Array.isArray(message.read_by)');
    expect(manageConversation).toContain('message.read_by.filter((readerId: string) => participantIds.includes(readerId))');
  });

  it('prunes departed users from message reactions and typing rows', async () => {
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');
    expect(manageConversation).toContain('function pruneReactions');
    expect(manageConversation).toContain('reactions: pruneReactions(message.reactions, participantIds)');
    expect(manageConversation).toContain('departedTypingRows');
    expect(manageConversation).toContain('await entities.TypingStatus.delete(row.id)');
  });

  it('highlights the current user reaction using the server reaction-key format', async () => {
    const bubble = await readText('src/components/messages/MessageBubble.jsx');
    expect(bubble).toContain("key.endsWith(`__${currentUser.id}`)");
    expect(bubble).not.toContain('(message.reactions || {})[currentUser.id]');
  });


  it('repairs message caches on delete and rate-limits moderated edits', async () => {
    const mutate = await readText('base44/functions/mutateConversationMessage/entry.ts');
    expect(mutate).toContain("'message_edit'");
    expect(mutate).toContain('status: 429');
    expect(mutate).toContain('thread_reply_count: remainingReplies.length');
    expect(mutate).toContain("last_message_at: latest?.created_date || null");
  });

  it('blocks message reactions while banned or timed out', async () => {
    const mutate = await readText('base44/functions/mutateConversationMessage/entry.ts');
    expect(mutate).toContain("if (action === 'react')");
    expect(mutate).toContain("if (user.is_banned)");
    expect(mutate).toContain("error: 'timed_out'");
  });


  it('scopes read receipts to conversation participants and updates them atomically', async () => {
    const readReceipt = await readText('base44/functions/markMessageRead/entry.ts');
    expect(readReceipt).toContain('message.participant_ids.includes(user.id)');
    expect(readReceipt).toContain('$addToSet');
    expect(readReceipt).toContain('status: 403');
  });

  it('rate-limits server-authoritative comment creation', async () => {
    const comments = await readText('base44/functions/trackComments/entry.ts');
    expect(comments).toContain("'track_comment'");
    expect(comments).toContain('status: 429');
  });


  it('rate-limits chat sends and conversation creation on the server', async () => {
    const sendMessage = await readText('base44/functions/sendConversationMessage/entry.ts');
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');

    expect(sendMessage).toContain("'conversation_message'");
    expect(sendMessage).toContain('status: 429');
    expect(manageConversation).toContain("'conversation_create'");
    expect(manageConversation).toContain('status: 429');
  });

  it('restricts banned appeals to direct admin conversations', async () => {
    const sendMessage = await readText('base44/functions/sendConversationMessage/entry.ts');
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');

    expect(sendMessage).toContain("conversation.type !== 'dm'");
    expect(sendMessage).toContain('conversation.participant_ids.length !== 2');
    expect(sendMessage).toContain("appealAdmin?.role !== 'admin'");
    expect(manageConversation).toContain("user.is_banned && ['create_group', 'create_public', 'join_public', 'rename'].includes(action)");
    expect(manageConversation).toContain("user.is_banned && otherUser.role !== 'admin'");
  });

  it('prevents timed-out users from creating or joining conversations', async () => {
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');
    expect(manageConversation).toContain("timeoutActive && ['create_dm', 'create_group', 'create_public', 'join_public', 'rename'].includes(action)");
    expect(manageConversation).toContain("error: 'timed_out'");
  });

  it('prevents ordinary members from renaming public rooms', async () => {
    const manageConversation = await readText('base44/functions/manageConversation/entry.ts');
    expect(manageConversation).toContain("conversation.is_public === true && user.role !== 'admin'");
    expect(manageConversation).toContain('Only an admin can rename a public room');
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


  it('claims squad invite membership atomically', async () => {
    const joinSquad = await readText('base44/functions/joinSquad/entry.ts');
    expect(joinSquad).toContain("status: 'pending'");
    expect(joinSquad).toContain('member_b_id: null');
    expect(joinSquad).toContain('Number(claim?.updated || 0) !== 1');
  });


  it('keeps project invites rate-limited and acceptance idempotent', async () => {
    const createInvite = await readText('base44/functions/createProjectInvite/entry.ts');
    const acceptInvite = await readText('base44/functions/acceptProjectInvite/entry.ts');

    expect(createInvite).toContain("'project_invite_create'");
    expect(createInvite).toContain('status: 429');
    expect(acceptInvite).toContain('already_member: true');
    expect(acceptInvite).toContain('(project.collaborator_ids || []).includes(user.id)');
  });


  it('keeps shared-file edit access synchronized with project collaborator roles', async () => {
    const collaborator = await readText('base44/functions/manageProjectCollaborator/entry.ts');
    expect(collaborator).toContain('edit_user_ids: Array.from(editUserIds)');
    expect(collaborator).not.toContain("entityName !== 'SharedFile'");
  });

  it('revokes public file share tokens when collaborator access changes', async () => {
    const collaborator = await readText('base44/functions/manageProjectCollaborator/entry.ts');
    expect(collaborator).toContain("if (entityName === 'SharedFile')");
    expect(collaborator).toContain('patch.share_token_hash = null');
    expect(collaborator).toContain('patch.share_token_expires_at = null');
  });

  it('keeps access backfill counters initialized before use and revokes stale file share links', async () => {
    const backfill = await readText('base44/functions/backfillTrackAccess/entry.ts');
    expect(backfill.indexOf('let updatedProjects = 0')).toBeLessThan(backfill.indexOf('updatedProjects += 1'));
    expect(backfill).toContain('share_token_hash: null');
    expect(backfill).toContain('share_token_expires_at: null');
  });


  it('keeps subscription billing Stripe-authoritative and rate-limited', async () => {
    const checkout = await readText('base44/functions/createSubscriptionCheckout/entry.ts');
    const portal = await readText('base44/functions/createBillingPortal/entry.ts');
    const wix = await readText('base44/functions/wixPaymentsWebhook/entry.ts');

    expect(checkout).toContain("'subscription_checkout'");
    expect(checkout).toContain('status: 429');
    expect(portal).toContain("'billing_portal'");
    expect(portal).toContain('status: 429');
    expect(wix).toContain('Ignoring legacy Wix order approval');
    expect(wix).not.toContain("status: 'active',\n          provider: 'wix'");
  });


  it('cancels Stripe billing before destructive account deletion', async () => {
    const deletion = await readText('base44/functions/deleteMyAccount/entry.ts');
    expect(deletion).toContain("'/subscriptions/'");
    expect(deletion).toContain("'DELETE'");
    expect(deletion).toContain('const subscriptions = await entities.Subscription.filter');
    expect(deletion.indexOf("'/subscriptions/'")).toBeLessThan(deletion.indexOf("await entities.User.delete(user.id)"));
  });

  it('authorizes purchase verification before calling Stripe', async () => {
    const verify = await readText('base44/functions/verifyCheckoutPayment/entry.ts');
    expect(verify).toContain('Invalid purchase verifier');
    expect(verify.indexOf('Invalid purchase verifier')).toBeLessThan(verify.indexOf("stripeRequest(`/checkout/sessions/"));
  });


  it('keeps payment verification local-first and deletion billing-safe', async () => {
    const verify = await readText('base44/functions/verifyCheckoutPayment/entry.ts');
    const deletion = await readText('base44/functions/deleteMyAccount/entry.ts');
    const webhook = await readText('base44/functions/stripeWebhook/entry.ts');

    expect(verify.indexOf('Base44Purchase.filter')).toBeLessThan(verify.indexOf("stripeRequest(`/checkout/sessions/"));
    expect(verify.indexOf('Invalid purchase verifier')).toBeLessThan(verify.indexOf("stripeRequest(`/checkout/sessions/"));
    expect(deletion).toContain("'/subscriptions/${encodeURIComponent(subscription.subscription_id)}'");
    expect(deletion).toContain('Legacy Wix billing must be canceled before account deletion');
    expect(webhook).toContain('deleted:${metadataUserId}');
    expect(webhook).toContain('if (isDeletedUserId(userId)) return');
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


  it('validates shared-file destination authority and media URL', async () => {
    const sharedFile = await readText('base44/functions/createSharedFileRecord/entry.ts');
    expect(sharedFile).toContain('valid HTTPS file_url');
    expect(sharedFile).toContain('Viewer access cannot add files to this folder');
    expect(sharedFile).toContain('folder_id does not belong to project_id');
    expect(sharedFile).toContain('file_size must be a non-negative number');
  });


  it('validates public media URLs before publishing or challenge submission', async () => {
    const createPost = await readText('base44/functions/createArtPost/entry.ts');
    const submitRemix = await readText('base44/functions/submitChallengeRemix/entry.ts');

    expect(createPost).toContain("parsed.protocol === 'https:'");
    expect(createPost).toContain('valid HTTPS file URL');
    expect(createPost).toContain('boundedNumber(body?.bpm, 1, 400)');
    expect(submitRemix).toContain("uploadedUrl.protocol !== 'https:'");
  });

  it('rejects collaborative tracks whose project or session parent does not exist', async () => {
    const createTrack = await readText('base44/functions/createCollaborativeTrack/entry.ts');
    expect(createTrack).toContain('const project = await entities.Project.get(projectId).catch(() => null)');
    expect(createTrack).toContain('const message = await entities.Message.get(projectId).catch(() => null)');
    expect(createTrack).toContain("error: 'Project/session not found'");
  });


  it('derives playlist ownership on the server and protects owner identity', async () => {
    const playlist = await readJson('base44/entities/Playlist.jsonc');
    const createPlaylist = await readText('base44/functions/createPlaylist/entry.ts');
    const playlistsPage = await readText('src/pages/Playlists.jsx');
    const addToPlaylist = await readText('src/components/explore/AddToPlaylistDialog.jsx');

    expect(playlist.rls.create?.user_condition?.role).toBe('admin');
    expect(playlist.properties.owner_id.rls?.write?.user_condition?.role).toBe('admin');
    expect(playlist.properties.owner_name.rls?.write?.user_condition?.role).toBe('admin');
    expect(createPlaylist).toContain('owner_id: user.id');
    expect(createPlaylist).toContain('One or more playlist tracks were not found');
    expect(playlistsPage).not.toContain('entities.Playlist.create');
    expect(addToPlaylist).not.toContain('entities.Playlist.create');
  });


  it('enforces configured challenge voting windows server-side', async () => {
    const vote = await readText('base44/functions/castVote/entry.ts');
    expect(vote).toContain('Voting has not opened yet.');
    expect(vote).toContain('Voting has ended.');
    expect(vote).toContain('challenge.submission_end_date');
    expect(vote).toContain('challenge.voting_end_date');
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
