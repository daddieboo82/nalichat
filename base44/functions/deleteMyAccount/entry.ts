import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

function deletedIdentity(userId: string): string {
  return `deleted:${userId}`;
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

    // Delete records that are private to this account and safe to remove.
    const ownedDeletes: Array<[string, string]> = [
      ['Achievement', 'user_id'],
      ['Contact', 'user_id'],
      ['Folder', 'owner_id'],
      ['Notification', 'recipient_id'],
      ['Playlist', 'owner_id'],
      ['StudioPresence', 'user_id'],
      ['TypingStatus', 'user_id'],
      ['PushSubscription', 'user_id'],
    ];

    for (const [entityName, ownerField] of ownedDeletes) {
      const entity = entities[entityName];
      if (!entity) continue;
      const rows = await entity.filter({ [ownerField]: user.id });
      for (const row of rows) {
        await entity.delete(row.id);
      }
    }

    // Remove private uploads. Project-linked files are retained for remaining
    // collaborators, but the departed uploader identity is anonymized.
    const uploadedFiles = await entities.SharedFile.filter({ uploader_id: user.id });
    for (const file of uploadedFiles) {
      if (file.project_id) {
        const remainingAccess = Array.isArray(file.access_user_ids)
          ? file.access_user_ids.filter((id: string) => id !== user.id)
          : [];
        await entities.SharedFile.update(file.id, {
          uploader_id: tombstoneId,
          uploader_name: 'Deleted User',
          access_user_ids: remainingAccess,
          share_token_hash: null,
        });
      } else {
        await entities.SharedFile.delete(file.id);
      }
    }

    // Preserve shared chat history for remaining participants, but remove
    // personal identity from messages authored by the deleted account.
    const authoredMessages = await entities.Message.filter({ sender_id: user.id });
    for (const message of authoredMessages) {
      await entities.Message.update(message.id, {
        sender_id: tombstoneId,
        sender_name: 'Deleted User',
        sender_avatar: null,
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
        await entities.Conversation.delete(conversation.id);
      } else {
        await entities.Conversation.update(conversation.id, { participant_ids: participantIds });
      }
    }

    // Collaborative projects remain available to collaborators. Solo projects
    // can be removed safely with their tracks.
    const ownedProjects = await entities.Project.filter({ owner_id: user.id });
    for (const project of ownedProjects) {
      const collaborators = Array.isArray(project.collaborator_ids)
        ? project.collaborator_ids.filter((id: string) => id !== user.id)
        : [];
      if (collaborators.length === 0) {
        const tracks = await entities.Track.filter({ project_id: project.id });
        for (const track of tracks) await entities.Track.delete(track.id);
        await entities.Project.delete(project.id);
      } else {
        await entities.Project.update(project.id, {
          owner_id: tombstoneId,
          collaborator_ids: collaborators,
        });
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
      await entities.Project.update(project.id, {
        collaborator_ids: collaboratorIds,
        collaborator_roles: collaboratorRoles,
      });
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
    const subscriptions = await entities.Subscription.filter({ user_id: user.id });
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
