import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { stripeRequest } from '../../shared/stripe.ts';

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

async function syncConversationAudience(entities: any, conversationId: string, participantIds: string[]) {
  const [messages, typingRows] = await Promise.all([
    entities.Message.filter({ conversation_id: conversationId }),
    entities.TypingStatus.filter({ conversation_id: conversationId }),
  ]);

  for (let i = 0; i < messages.length; i += 100) {
    await entities.Message.bulkUpdate(
      messages.slice(i, i + 100).map((message: any) => ({
        id: message.id,
        participant_ids: participantIds,
        read_by: Array.isArray(message.read_by)
          ? message.read_by.filter((readerId: string) => participantIds.includes(readerId))
          : [],
        reactions: pruneConversationReactions(message.reactions, participantIds),
      })),
    );
  }

  const activeTypingRows = typingRows.filter((row: any) => participantIds.includes(row.user_id));
  const departedTypingRows = typingRows.filter((row: any) => !participantIds.includes(row.user_id));
  for (let i = 0; i < activeTypingRows.length; i += 100) {
    await entities.TypingStatus.bulkUpdate(
      activeTypingRows.slice(i, i + 100).map((row: any) => ({
        id: row.id,
        participant_ids: participantIds,
      })),
    );
  }
  for (const row of departedTypingRows) {
    await entities.TypingStatus.delete(row.id);
  }
}

Deno.serve(async (req) => {
  try {
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
    const tombstoneId = deletedIdentity(user.id);

    // Cancel live Stripe billing before deleting account access. If cancellation
    // fails, abort deletion so the user is never stranded without a billing
    // portal while an external subscription can continue charging.
    const subscriptions = await entities.Subscription.filter({ user_id: user.id });
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
      const rows = await entity.filter({ [ownerField]: user.id });
      for (const row of rows) {
        await entity.delete(row.id);
      }
    }

    // Remove references to the deleted account from other users' contact lists.
    const inboundContacts = await entities.Contact.filter({ contact_user_id: user.id });
    for (const contact of inboundContacts) {
      await entities.Contact.delete(contact.id);
    }

    // Preserve moderation history while anonymizing both subject and reporter
    // identity when the deleted account appears in a Violation record.
    const subjectViolations = await entities.Violation.filter({ user_id: user.id });
    for (const violation of subjectViolations) {
      await entities.Violation.update(violation.id, {
        user_id: tombstoneId,
        user_name: 'Deleted User',
      });
    }
    const reporterViolations = await entities.Violation.filter({ reported_by_id: user.id });
    for (const violation of reporterViolations) {
      await entities.Violation.update(violation.id, {
        reported_by_id: tombstoneId,
        reported_by_name: 'Deleted User',
      });
    }

    // Remove private uploads. Project-linked files are retained for remaining
    // collaborators, but the departed uploader identity is anonymized.
    const uploadedFiles = await entities.SharedFile.filter({ uploader_id: user.id });
    for (const file of uploadedFiles) {
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
    }

    // Preserve shared chat history for remaining participants, but remove
    // personal identity from messages authored by the deleted account.
    const authoredMessages = await entities.Message.filter({ sender_id: user.id });
    const authoredMessageIds = new Set(authoredMessages.map((message: any) => message.id));
    for (const message of authoredMessages) {
      await entities.Message.update(message.id, {
        sender_id: tombstoneId,
        sender_name: 'Deleted User',
        sender_avatar: null,
      });
    }

    // Replies cache the original sender label separately from the parent
    // message. Anonymize that copied identity while preserving quoted text.
    if (authoredMessageIds.size > 0) {
      for (const parentId of authoredMessageIds) {
        const replies = await entities.Message.filter({ reply_to_id: parentId });
        for (const reply of replies) {
          if (reply.reply_to_sender) {
            await entities.Message.update(reply.id, { reply_to_sender: 'Deleted User' });
          }
        }
      }
    }

    // Preserve public releases and comments, but remove personal identity.
    const authoredPosts = await entities.ArtPost.filter({ creator_id: user.id });
    for (const post of authoredPosts) {
      await entities.ArtPost.update(post.id, {
        creator_id: tombstoneId,
        creator_name: 'Deleted User',
        creator_avatar: null,
      });
    }

    const authoredComments = await entities.TrackComment.filter({ author_id: user.id });
    for (const comment of authoredComments) {
      await entities.TrackComment.update(comment.id, {
        author_id: tombstoneId,
        author_name: 'Deleted User',
        author_avatar: null,
      });
    }

    // Remove likes cast by the deleted account while keeping aggregate counts correct.
    const likedPosts = await entities.ArtPost.filter({ liked_by: user.id });
    for (const post of likedPosts) {
      const likedBy = Array.isArray(post.liked_by)
        ? post.liked_by.filter((id: string) => id !== user.id)
        : [];
      await entities.ArtPost.update(post.id, {
        liked_by: likedBy,
        likes: likedBy.length,
      });
    }

    // Remove challenge votes cast by the deleted account and reconcile totals.
    const challengeVotes = await entities.ChallengeVote.filter({ voter_id: user.id });
    for (const vote of challengeVotes) {
      try {
        const submission = await entities.ChallengeSubmission.get(vote.submission_id);
        if (submission) {
          await entities.ChallengeSubmission.update(submission.id, {
            vote_count: Math.max(0, Number(submission.vote_count || 0) - 1),
          });
        }
      } catch {}
      await entities.ChallengeVote.delete(vote.id);
    }

    // Notifications delivered to other users may retain actor identity; anonymize it.
    const actorNotifications = await entities.Notification.filter({ actor_id: user.id });
    for (const notification of actorNotifications) {
      await entities.Notification.update(notification.id, {
        actor_id: tombstoneId,
        actor_name: 'Deleted User',
        actor_avatar: null,
      });
    }

    // Remove the account from conversation membership without deleting the
    // conversation for other participants.
    const conversations = await entities.Conversation.filter({ participant_ids: user.id });
    for (const conversation of conversations) {
      const participantIds = Array.isArray(conversation.participant_ids)
        ? conversation.participant_ids.filter((id: string) => id !== user.id)
        : [];
      if (participantIds.length === 0) {
        const [messages, typingRows] = await Promise.all([
          entities.Message.filter({ conversation_id: conversation.id }),
          entities.TypingStatus.filter({ conversation_id: conversation.id }),
        ]);
        for (const message of messages) await entities.Message.delete(message.id);
        for (const typing of typingRows) await entities.TypingStatus.delete(typing.id);
        await entities.Conversation.delete(conversation.id);
      } else {
        await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
        await syncConversationAudience(entities, conversation.id, participantIds);
      }
    }

    // Collaborative projects stay manageable by transferring ownership to a
    // real remaining collaborator (prefer an existing editor). Solo projects
    // are removed together with all project-scoped child records.
    const ownedProjects = await entities.Project.filter({ owner_id: user.id });
    for (const project of ownedProjects) {
      const collaborators = Array.isArray(project.collaborator_ids)
        ? project.collaborator_ids.filter((id: string) => id !== user.id)
        : [];
      const editors = Array.isArray(project.editor_ids)
        ? project.editor_ids.filter((id: string) => id !== user.id)
        : [];

      if (collaborators.length === 0) {
        const tracks = await entities.Track.filter({ project_id: project.id });
        const trackIds = tracks.map((track: any) => track.id);

        for (const trackId of trackIds) {
          const comments = await entities.TrackComment.filter({ track_id: trackId, parent_type: 'track' });
          for (const comment of comments) await entities.TrackComment.delete(comment.id);
        }

        for (const entityName of ['TrackVersion', 'Track', 'SharedFile', 'Folder', 'Milestone', 'ProjectInvite']) {
          const entity = entities[entityName];
          if (!entity) continue;
          const rows = await entity.filter({ project_id: project.id });
          for (const row of rows) await entity.delete(row.id);
        }

        const presenceRows = await entities.StudioPresence.filter({ room_id: project.id });
        for (const presence of presenceRows) await entities.StudioPresence.delete(presence.id);

        await entities.Project.delete(project.id);
        continue;
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
        const rows = await entity.filter({ project_id: project.id });
        for (const row of rows) {
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
        }
      }
    }

    // Remove the deleted account from projects where it was only a collaborator.
    const collaboratedProjects = await entities.Project.filter({ collaborator_ids: user.id });
    for (const project of collaboratedProjects) {
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
        const rows = await entity.filter({ project_id: project.id });
        for (const row of rows) {
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
        }
      }
    }

    // Public challenge records may have other users' submissions/votes, so keep
    // them but anonymize the departed host identity.
    const hostedChallenges = await entities.Challenge.filter({ host_artist_id: user.id });
    for (const challenge of hostedChallenges) {
      await entities.Challenge.update(challenge.id, {
        host_artist_id: tombstoneId,
        host_artist_name: 'Deleted User',
      });
    }

    // Preserve public submissions for challenge integrity while removing PII.
    const submissions = await entities.ChallengeSubmission.filter({ producer_id: user.id });
    for (const submission of submissions) {
      await entities.ChallengeSubmission.update(submission.id, {
        producer_id: tombstoneId,
        producer_name: 'Deleted User',
        producer_avatar: null,
      });
    }

    // Squads are shared records: end them instead of deleting a partner's data.
    const squadsAsA = await entities.Squad.filter({ member_a_id: user.id });
    for (const squad of squadsAsA) {
      await entities.Squad.update(squad.id, {
        member_a_id: tombstoneId,
        member_a_name: 'Deleted User',
        status: 'ended',
      });
    }
    const squadsAsB = await entities.Squad.filter({ member_b_id: user.id });
    for (const squad of squadsAsB) {
      await entities.Squad.update(squad.id, {
        member_b_id: tombstoneId,
        member_b_name: 'Deleted User',
        status: 'ended',
      });
    }

    // Subscription and purchase records are intentionally retained as billing
    // history; remove direct account identity where possible while retaining
    // Stripe reconciliation IDs.
    for (const subscription of subscriptions) {
      await entities.Subscription.update(subscription.id, { user_id: tombstoneId });
    }
    const purchases = await entities.Base44Purchase.filter({ user_id: user.id });
    for (const purchase of purchases) {
      await entities.Base44Purchase.update(purchase.id, {
        user_id: tombstoneId,
        user_email: null,
      });
    }

    await entities.User.delete(user.id);
    return Response.json({ success: true });
  } catch (error) {
    console.error('deleteMyAccount failed:', error);
    return Response.json(
      { error: error?.message || 'Account deletion failed' },
      { status: 500 },
    );
  }
});
