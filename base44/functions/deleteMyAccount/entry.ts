import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';
import { acquireAccountDeletionLock, releaseAccountDeletionLock } from '../../shared/accountDeletionLock.ts';

const CLEANUP_BATCH_SIZE = 200;

function deletedIdentity(userId: string): string {
  return `deleted:${userId}`;
}

function pruneConversationReactions(reactions: unknown, participantIds: string[]) {
  if (!reactions || typeof reactions !== 'object' || Array.isArray(reactions)) return {};
  const allowed = new Set(participantIds);
  return Object.fromEntries(
    Object.entries(reactions as Record<string, unknown>).filter(([key]) => {
      const separator = key.lastIndexOf('__');
      if (separator < 0) return false;
      return allowed.has(key.slice(separator + 2));
    }),
  );
}

async function processMatchingBatches(
  entity: any,
  query: Record<string, unknown>,
  process: (row: any) => Promise<unknown>,
): Promise<number> {
  let processed = 0;
  while (true) {
    const rows = await entity.filter(query, '-created_date', CLEANUP_BATCH_SIZE);
    if (rows.length === 0) return processed;
    for (const row of rows) {
      await process(row);
      processed += 1;
    }
    if (rows.length < CLEANUP_BATCH_SIZE) return processed;
  }
}

async function processPagedRows(
  entity: any,
  query: Record<string, unknown>,
  process: (row: any) => Promise<unknown>,
): Promise<number> {
  let processed = 0;
  for (let skip = 0; ; skip += CLEANUP_BATCH_SIZE) {
    const rows = await entity.filter(query, '-created_date', CLEANUP_BATCH_SIZE, skip);
    for (const row of rows) {
      await process(row);
      processed += 1;
    }
    if (rows.length < CLEANUP_BATCH_SIZE) return processed;
  }
}

async function syncConversationAudience(
  entities: any,
  conversationId: string,
  participantIds: string[],
  departedUserId: string,
) {
  await processPagedRows(
    entities.Message,
    { conversation_id: conversationId },
    (message) => entities.Message.update(message.id, {
      participant_ids: participantIds,
      read_by: Array.isArray(message.read_by)
        ? message.read_by.filter((readerId: string) => participantIds.includes(readerId))
        : [],
      reactions: pruneConversationReactions(message.reactions, participantIds),
    }),
  );
  await processMatchingBatches(
    entities.TypingStatus,
    { conversation_id: conversationId, user_id: departedUserId },
    (row) => entities.TypingStatus.delete(row.id),
  );
  await processPagedRows(
    entities.TypingStatus,
    { conversation_id: conversationId },
    (row) => entities.TypingStatus.update(row.id, { participant_ids: participantIds }),
  );
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    if (body?.confirmation !== 'DELETE') {
      return Response.json({ error: 'Confirmation required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    const lockId = await acquireAccountDeletionLock(entities, user.id);
    if (!lockId) {
      return Response.json(
        { error: 'Account deletion is already in progress.' },
        { status: 409 },
      );
    }

    try {
    const tombstoneId = deletedIdentity(user.id);

    // Cancel live Stripe billing before deleting account access. If cancellation
    // fails, abort deletion so the user is never stranded without a billing
    // portal while an external subscription can continue charging.
    for (let subscriptionSkip = 0; ; subscriptionSkip += CLEANUP_BATCH_SIZE) {
      const subscriptions = await entities.Subscription.filter(
        { user_id: user.id },
        '-created_date',
        CLEANUP_BATCH_SIZE,
        subscriptionSkip,
      );
      for (const subscription of subscriptions) {
        if (
          subscription.provider === 'stripe'
          && subscription.subscription_id
          && !['canceled', 'ended'].includes(String(subscription.status || ''))
        ) {
          await stripeRequest(
            `/subscriptions/${encodeURIComponent(subscription.subscription_id)}`,
            {},
            'DELETE',
            { idempotencyKey: `delete_account_cancel_${subscription.id}`.slice(0, 255) },
          );
          await entities.Subscription.update(subscription.id, {
            status: 'canceled',
            cancel_at_period_end: false,
            current_period_end: new Date().toISOString(),
          });
        } else if (
          subscription.provider === 'stripe'
          && subscription.checkout_id
          && ['pending', 'incomplete'].includes(String(subscription.status || ''))
        ) {
          try {
            await stripeRequest(
              `/checkout/sessions/${encodeURIComponent(subscription.checkout_id)}/expire`,
              {},
              'POST',
              { idempotencyKey: `delete_account_expire_${subscription.id}`.slice(0, 255) },
            );
          } catch (error) {
            console.warn('Could not expire pending checkout during account deletion:', error);
          }
        } else if (
          subscription.provider === 'wix'
          && subscription.subscription_id
          && !['canceled', 'ended'].includes(String(subscription.status || ''))
        ) {
          const wixApiKey = Deno.env.get('WIX_PAYMENTS_API_KEY');
          const wixSiteId = Deno.env.get('WIX_PAYMENTS_SITE_ID');
          if (!wixApiKey || !wixSiteId) {
            return Response.json(
              { error: 'Legacy Wix billing must be canceled before account deletion. Please contact support.' },
              { status: 409 },
            );
          }

          const cancelRes = await fetch(
          `https://www.wixapis.com/payments/base44/v1/subscriptions/${encodeURIComponent(subscription.subscription_id)}/cancel`,
          {
            method: 'POST',
            headers: {
              Authorization: wixApiKey,
              'wix-site-id': wixSiteId,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              subscription_id: subscription.subscription_id,
              immediate: true,
            }),
          },
        );
          if (!cancelRes.ok) {
            console.error('Failed to cancel legacy Wix subscription:', await cancelRes.text());
            return Response.json(
              { error: 'Legacy Wix billing could not be canceled. Account deletion was stopped.' },
              { status: 502 },
            );
          }
          await entities.Subscription.update(subscription.id, {
            status: 'canceled',
            cancel_at_period_end: false,
            current_period_end: new Date().toISOString(),
          });
        }
      }
      if (subscriptions.length < CLEANUP_BATCH_SIZE) break;
    }

    // Delete records that are private to this account and safe to remove.
    const ownedDeletes: Array<[string, string]> = [
      ['Achievement', 'user_id'],
      ['Contact', 'user_id'],
      ['Notification', 'recipient_id'],
      ['Playlist', 'owner_id'],
      ['StudioPresence', 'user_id'],
      ['TypingStatus', 'user_id'],
      ['PushSubscription', 'user_id'],
      ['SquadActivity', 'user_id'],
      ['SquadReward', 'user_id'],
      ['UserActivityReward', 'user_id'],
      ['UsageRateLimit', 'user_id'],
      ['ProjectInvite', 'created_by_id'],
    ];

    for (const [entityName, ownerField] of ownedDeletes) {
      const entity = entities[entityName];
      if (!entity) continue;
      await processMatchingBatches(
        entity,
        { [ownerField]: user.id },
        (row) => entity.delete(row.id),
      );
    }

    // Remove references to the deleted account from other users' contact lists.
    await processMatchingBatches(
      entities.Contact,
      { contact_user_id: user.id },
      (contact) => entities.Contact.delete(contact.id),
    );

    // Preserve moderation history while anonymizing both subject and reporter
    // identity when the deleted account appears in a Violation record.
    await processMatchingBatches(
      entities.Violation,
      { user_id: user.id },
      (violation) => entities.Violation.update(violation.id, {
        user_id: tombstoneId,
        user_name: 'Deleted User',
      }),
    );
    await processMatchingBatches(
      entities.Violation,
      { reported_by_id: user.id },
      (violation) => entities.Violation.update(violation.id, {
        reported_by_id: tombstoneId,
        reported_by_name: 'Deleted User',
      }),
    );

    // Remove private uploads. Project-linked files are retained for remaining
    // collaborators, but the departed uploader identity is anonymized.
    await processMatchingBatches(
      entities.SharedFile,
      { uploader_id: user.id },
      async (file) => {
        if (file.project_id) {
          const remainingAccess = Array.isArray(file.access_user_ids)
            ? file.access_user_ids.filter((id: string) => id !== user.id)
            : [];
          const remainingEditors = Array.isArray(file.edit_user_ids)
            ? file.edit_user_ids.filter((id: string) => id !== user.id)
            : [];
          await entities.SharedFile.update(file.id, {
            uploader_id: tombstoneId,
            uploader_name: 'Deleted User',
            access_user_ids: remainingAccess,
            edit_user_ids: remainingEditors,
            share_token_hash: null,
            share_token_expires_at: null,
          });
        } else {
          await entities.SharedFile.delete(file.id);
        }
      },
    );

    // Preserve shared chat history for remaining participants, but remove
    // personal identity from messages authored by the deleted account.
    await processMatchingBatches(
      entities.Message,
      { sender_id: user.id },
      async (message) => {
        // Replies cache the original sender label separately from the parent.
        await processPagedRows(
          entities.Message,
          { reply_to_id: message.id },
          (reply) => reply.reply_to_sender
            ? entities.Message.update(reply.id, { reply_to_sender: 'Deleted User' })
            : Promise.resolve(),
        );
        await entities.Message.update(message.id, {
          sender_id: tombstoneId,
          sender_name: 'Deleted User',
          sender_avatar: null,
        });
      },
    );

    // Preserve public releases and comments, but remove personal identity.
    await processMatchingBatches(
      entities.ArtPost,
      { creator_id: user.id },
      (post) => entities.ArtPost.update(post.id, {
        creator_id: tombstoneId,
        creator_name: 'Deleted User',
        creator_avatar: null,
      }),
    );

    await processMatchingBatches(
      entities.TrackComment,
      { author_id: user.id },
      (comment) => entities.TrackComment.update(comment.id, {
        author_id: tombstoneId,
        author_name: 'Deleted User',
        author_avatar: null,
      }),
    );

    // Remove likes cast by the deleted account atomically so concurrent
    // likes/unlikes cannot be overwritten by a stale liked_by snapshot.
    await processMatchingBatches(
      entities.ArtPost,
      { liked_by: user.id },
      async (post) => {
        await entities.ArtPost.updateMany(
          { id: post.id },
          { $pull: { liked_by: user.id } },
        );
        const refreshedPost = await entities.ArtPost.get(post.id).catch(() => null);
        if (refreshedPost) {
          await entities.ArtPost.update(post.id, {
            likes: Array.isArray(refreshedPost.liked_by) ? refreshedPost.liked_by.length : 0,
          });
        }
      },
    );

    // Remove challenge votes cast by the deleted account and reconcile totals
    // atomically so concurrent votes cannot be overwritten by a stale read.
    await processMatchingBatches(
      entities.ChallengeVote,
      { voter_id: user.id },
      async (vote) => {
        try {
          await entities.ChallengeSubmission.updateMany(
            { id: vote.submission_id, vote_count: { $gt: 0 } },
            { $inc: { vote_count: -1 } },
          );
        } catch {}
        await entities.ChallengeVote.delete(vote.id);
      },
    );

    // Notifications delivered to other users may retain actor identity; anonymize it.
    await processMatchingBatches(
      entities.Notification,
      { actor_id: user.id },
      (notification) => entities.Notification.update(notification.id, {
        actor_id: tombstoneId,
        actor_name: 'Deleted User',
        actor_avatar: null,
      }),
    );

    // Remove the account from conversation membership without deleting the
    // conversation for other participants.
    await processMatchingBatches(
      entities.Conversation,
      { participant_ids: user.id },
      async (conversation) => {
        const participantIds = Array.isArray(conversation.participant_ids)
          ? conversation.participant_ids.filter((id: string) => id !== user.id)
          : [];
        if (participantIds.length === 0) {
          await processMatchingBatches(
            entities.Message,
            { conversation_id: conversation.id },
            (message) => entities.Message.delete(message.id),
          );
          await processMatchingBatches(
            entities.TypingStatus,
            { conversation_id: conversation.id },
            (typing) => entities.TypingStatus.delete(typing.id),
          );
          await entities.Conversation.delete(conversation.id);
        } else {
          await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
          await syncConversationAudience(entities, conversation.id, participantIds, user.id);
        }
      },
    );

    // Collaborative projects stay manageable by transferring ownership to a
    // real remaining collaborator (prefer an existing editor). Solo projects
    // are removed together with all project-scoped child records.
    await processMatchingBatches(
      entities.Project,
      { owner_id: user.id },
      async (project) => {
      const collaborators = Array.isArray(project.collaborator_ids)
        ? project.collaborator_ids.filter((id: string) => id !== user.id)
        : [];
      const editors = Array.isArray(project.editor_ids)
        ? project.editor_ids.filter((id: string) => id !== user.id)
        : [];

      if (collaborators.length === 0) {
        await processPagedRows(
          entities.Track,
          { project_id: project.id },
          (track) => processMatchingBatches(
            entities.TrackComment,
            { track_id: track.id, parent_type: 'track' },
            (comment) => entities.TrackComment.delete(comment.id),
          ),
        );

        for (const entityName of ['TrackVersion', 'Track', 'SharedFile', 'Folder', 'Milestone', 'ProjectInvite']) {
          const entity = entities[entityName];
          if (!entity) continue;
          await processMatchingBatches(
            entity,
            { project_id: project.id },
            (row) => entity.delete(row.id),
          );
        }

        await processMatchingBatches(
          entities.StudioPresence,
          { room_id: project.id },
          (presence) => entities.StudioPresence.delete(presence.id),
        );

        await entities.Project.delete(project.id);
        return;
      }

      const successor = editors.find((id: string) => collaborators.includes(id)) || collaborators[0];
      const remainingCollaborators = collaborators.filter((id: string) => id !== successor);
      const remainingEditors = editors.filter((id: string) => id !== successor);
      const collaboratorRoles = { ...(project.collaborator_roles || {}) };
      delete collaboratorRoles[user.id];
      delete collaboratorRoles[successor];

      await entities.Project.update(project.id, {
        owner_id: successor,
        collaborator_ids: remainingCollaborators,
        editor_ids: remainingEditors,
        collaborator_roles: collaboratorRoles,
      });

      for (const entityName of ['TrackVersion', 'Track', 'SharedFile', 'Folder', 'Milestone']) {
        const entity = entities[entityName];
        if (!entity) continue;
        await processPagedRows(entity, { project_id: project.id }, async (row) => {
          const accessUserIds = Array.from(new Set([
            ...(Array.isArray(row.access_user_ids) ? row.access_user_ids : []),
            successor,
          ].filter((id: string) => id && id !== user.id)));
          const editUserIds = Array.from(new Set([
            ...(Array.isArray(row.edit_user_ids) ? row.edit_user_ids : []),
            successor,
          ].filter((id: string) => id && id !== user.id)));
          const update: Record<string, unknown> = {
            access_user_ids: accessUserIds,
            edit_user_ids: editUserIds,
          };
          if (entityName === 'Folder' && row.owner_id === user.id) update.owner_id = successor;
          if (entityName === 'Track' && row.uploaded_by === user.id) update.uploaded_by = tombstoneId;
          if (entityName === 'TrackVersion' && row.saved_by_id === user.id) {
            update.saved_by_id = tombstoneId;
            update.saved_by_name = 'Deleted User';
          }
          if (entityName === 'SharedFile' && row.uploader_id === user.id) {
            update.uploader_id = tombstoneId;
            update.uploader_name = 'Deleted User';
            update.share_token_hash = null;
          }
          await entity.update(row.id, update);
        });
      }
      },
    );

    // Remove the deleted account from projects where it was only a collaborator.
    await processMatchingBatches(
      entities.Project,
      { collaborator_ids: user.id },
      async (project) => {
      const collaboratorIds = Array.isArray(project.collaborator_ids)
        ? project.collaborator_ids.filter((id: string) => id !== user.id)
        : [];
      const collaboratorRoles = { ...(project.collaborator_roles || {}) };
      delete collaboratorRoles[user.id];
      const editorIds = Array.isArray(project.editor_ids)
        ? project.editor_ids.filter((id: string) => id !== user.id)
        : [];
      await entities.Project.update(project.id, {
        collaborator_ids: collaboratorIds,
        editor_ids: editorIds,
        collaborator_roles: collaboratorRoles,
      });

      for (const entityName of ['TrackVersion', 'Track', 'SharedFile', 'Folder', 'Milestone']) {
        const entity = entities[entityName];
        if (!entity) continue;
        await processPagedRows(entity, { project_id: project.id }, async (row) => {
          const update: Record<string, unknown> = {
            access_user_ids: Array.isArray(row.access_user_ids)
              ? row.access_user_ids.filter((id: string) => id !== user.id)
              : [],
            edit_user_ids: Array.isArray(row.edit_user_ids)
              ? row.edit_user_ids.filter((id: string) => id !== user.id)
              : [],
          };

          if (entityName === 'Track' && row.uploaded_by === user.id) {
            update.uploaded_by = tombstoneId;
          }
          if (entityName === 'TrackVersion' && row.saved_by_id === user.id) {
            update.saved_by_id = tombstoneId;
            update.saved_by_name = 'Deleted User';
          }
          if (entityName === 'Folder' && row.owner_id === user.id) {
            // Keep project folders usable by transferring ownership to the
            // project owner rather than leaving a deleted-user reference.
            update.owner_id = project.owner_id;
          }
          if (entityName === 'SharedFile' && row.uploader_id === user.id) {
            update.uploader_id = tombstoneId;
            update.uploader_name = 'Deleted User';
            update.share_token_hash = null;
            update.share_token_expires_at = null;
          }

          await entity.update(row.id, update);
        });
      }
      },
    );

    // Public challenge records may have other users' submissions/votes, so keep
    // them but anonymize the departed host identity.
    await processMatchingBatches(
      entities.Challenge,
      { host_artist_id: user.id },
      (challenge) => entities.Challenge.update(challenge.id, {
        host_artist_id: tombstoneId,
        host_artist_name: 'Deleted User',
      }),
    );

    // Preserve public submissions for challenge integrity while removing PII.
    await processMatchingBatches(
      entities.ChallengeSubmission,
      { producer_id: user.id },
      (submission) => entities.ChallengeSubmission.update(submission.id, {
        producer_id: tombstoneId,
        producer_name: 'Deleted User',
        producer_avatar: null,
      }),
    );

    // Squads are shared records: end them instead of deleting a partner's data.
    await processMatchingBatches(
      entities.Squad,
      { member_a_id: user.id },
      async (squad) => {
        await entities.Squad.update(squad.id, {
        member_a_id: tombstoneId,
        member_a_name: 'Deleted User',
        status: 'ended',
        });
        if (squad.member_b_id) {
          await entities.User.updateMany(
            { id: squad.member_b_id, squad_membership_id: squad.id },
            { $set: { squad_membership_id: null } },
          ).catch(() => {});
        }
      },
    );
    await processMatchingBatches(
      entities.Squad,
      { member_b_id: user.id },
      async (squad) => {
        await entities.Squad.update(squad.id, {
        member_b_id: tombstoneId,
        member_b_name: 'Deleted User',
        status: 'ended',
        });
        if (squad.member_a_id) {
          await entities.User.updateMany(
            { id: squad.member_a_id, squad_membership_id: squad.id },
            { $set: { squad_membership_id: null } },
          ).catch(() => {});
        }
      },
    );

    // Subscription and purchase records are intentionally retained as billing
    // history; remove direct account identity where possible while retaining
    // Stripe reconciliation IDs.
    await processMatchingBatches(
      entities.Subscription,
      { user_id: user.id },
      (subscription) => entities.Subscription.update(subscription.id, { user_id: tombstoneId }),
    );
    await processMatchingBatches(
      entities.Base44Purchase,
      { user_id: user.id },
      (purchase) => entities.Base44Purchase.update(purchase.id, {
        user_id: tombstoneId,
        user_email: null,
      }),
    );

    await entities.User.delete(user.id);
    return Response.json({ success: true });
    } finally {
      await releaseAccountDeletionLock(entities, lockId);
    }
  } catch (error) {
    console.error('deleteMyAccount failed:', error);
    return Response.json(
      { error: error?.message || 'Account deletion failed' },
      { status: 500 },
    );
  }
});
