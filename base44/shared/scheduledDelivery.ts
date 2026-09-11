import {
  classifyMessageText,
  enforceModerationResult,
} from './messageModeration.ts';
import type {
  ModerationDependencies,
  ModerationResult,
} from './messageModeration.ts';
import { resolveUserSubscription } from './subscriptionAccess.ts';
import type { SubscriptionRecord } from './subscriptionAccess.ts';
import {
  MAX_DELIVERY_ATTEMPTS,
  SCHEDULE_ENTITLEMENT,
  ScheduledFailureCode,
  ScheduledRecord,
  MessageConversation,
  MessageUser,
  assertConversationMembership,
  getEntityOrNull,
  renewScheduledClaim,
  retryDelayMs,
  senderSafetyFailure,
  transitionClaim,
} from './scheduledMessages.ts';

interface EntityReader<T extends Record<string, unknown>> {
  get(id: string): Promise<T>;
}

interface ScheduledEntity extends EntityReader<ScheduledRecord> {
  updateMany(
    query: Record<string, unknown>,
    update: Record<string, Record<string, unknown>>,
  ): Promise<{ updated: number }>;
}

interface DeliveryEntities {
  ScheduledMessage: ScheduledEntity;
  Subscription: {
    filter(
      query: Record<string, unknown>,
      sort: string,
      limit: number,
      skip: number,
    ): Promise<SubscriptionRecord[]>;
  };
  Conversation: EntityReader<MessageConversation> & {
    update(id: string, input: Record<string, unknown>): Promise<MessageConversation>;
    updateMany(
      query: Record<string, unknown>,
      update: Record<string, Record<string, unknown>>,
    ): Promise<{ updated: number }>;
  };
  User: EntityReader<MessageUser> & {
    update(id: string, input: Record<string, unknown>): Promise<MessageUser>;
    updateMany(
      query: Record<string, unknown>,
      update: Record<string, Record<string, unknown>>,
    ): Promise<{ updated: number }>;
  };
  Message: {
    filter(
      query: Record<string, unknown>,
      sort: string,
      limit: number,
    ): Promise<Array<Record<string, unknown> & { id: string; created_date?: string }>>;
    create(input: Record<string, unknown>): Promise<Record<string, unknown> & { id: string; created_date?: string }>;
    delete(id: string): Promise<unknown>;
  };
  Violation: {
    create(input: Record<string, unknown>): Promise<unknown>;
  };
}

interface DeliveryIntegrations {
  Core: {
    InvokeLLM(input: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
}

interface AccessResult {
  entitlements: Record<string, boolean>;
}

export interface DeliveryDependencies {
  entities: DeliveryEntities;
  integrations: DeliveryIntegrations;
  resolveAccess?: (
    subscriptionEntity: DeliveryEntities['Subscription'],
    userId: string,
    now: string,
  ) => Promise<AccessResult>;
  classify?: (input: {
    text: string;
    integrations: DeliveryIntegrations;
  }) => Promise<ModerationResult>;
  enforceModeration?: (input: {
    classification: ModerationResult;
    text: string;
    user: MessageUser;
    conversationId: string;
    messageId: null;
    scheduledMessageId: string;
    dependencies: ModerationDependencies;
    now: Date;
  }) => Promise<ModerationResult>;
  clock?: () => Date;
}

async function markFailed(
  entity: ScheduledEntity,
  record: ScheduledRecord,
  claimToken: string,
  code: ScheduledFailureCode,
  now: Date,
) {
  const committed = await transitionClaim(entity, record, claimToken, {
    status: 'failed',
    failure_code: code,
    updated_at: now.toISOString(),
    claim_token: null,
    claim_expires_at: null,
  });
  return committed
    ? { id: record.id, outcome: 'failed', code }
    : { id: record.id, outcome: 'claim_lost' };
}

export async function deliverClaimedScheduledMessage({
  dependencies,
  record,
  claimToken,
  now,
}: {
  dependencies: DeliveryDependencies;
  record: ScheduledRecord;
  claimToken: string;
  now: Date;
}) {
  const { entities, integrations } = dependencies;
  const existingMessages = await entities.Message.filter(
    { scheduled_message_id: record.id },
    'created_date',
    10,
  );
  if (existingMessages.length) {
    return reconcileClaimedScheduledDelivery({
      entities,
      record,
      claimToken,
      now,
      messages: existingMessages,
    });
  }

  let conversation = await getEntityOrNull(entities.Conversation, record.conversation_id);
  if (!conversation) {
    return markFailed(
      entities.ScheduledMessage,
      record,
      claimToken,
      'CONVERSATION_UNAVAILABLE',
      now,
    );
  }

  let deliveredMessage = null;
  if (!deliveredMessage) {
    let sender = await getEntityOrNull(entities.User, record.sender_id);
    if (!sender) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'SENDER_UNAVAILABLE',
        now,
      );
    }
    try {
      assertConversationMembership(record.sender_id, conversation);
    } catch {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'SENDER_NOT_MEMBER',
        now,
      );
    }

    const participantUsers = (await Promise.all(
      (conversation.participant_ids || []).map((id) => getEntityOrNull(entities.User, id)),
    )).filter((participant): participant is MessageUser => participant !== null);
    const safetyFailure = senderSafetyFailure(sender, conversation, participantUsers, now);
    if (safetyFailure) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        safetyFailure,
        now,
      );
    }

    const resolveAccess = dependencies.resolveAccess || resolveUserSubscription;
    const access = await resolveAccess(
      entities.Subscription,
      record.sender_id,
      now.toISOString(),
    );
    if (!access.entitlements[SCHEDULE_ENTITLEMENT]) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'ENTITLEMENT_REVOKED',
        now,
      );
    }

    const beforeModeration = dependencies.clock?.() || new Date();
    const stillOwned = await renewScheduledClaim(
      entities.ScheduledMessage,
      record,
      claimToken,
      beforeModeration,
    );
    if (!stillOwned) return { id: record.id, outcome: 'claim_lost' };

    const classify = dependencies.classify || classifyMessageText;
    const moderation = await classify({
      text: record.payload.text,
      integrations,
    });
    if (moderation.flagged) {
      const failure = await markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'MODERATION_REJECTED',
        now,
      );
      if (failure.outcome === 'failed') {
        const enforce = dependencies.enforceModeration || enforceModerationResult;
        try {
          await enforce({
            classification: moderation,
            text: record.payload.text,
            user: sender,
            conversationId: record.conversation_id,
            messageId: null,
            scheduledMessageId: record.id,
            dependencies: { integrations, entities },
            now,
          });
        } catch (error) {
          console.error('Scheduled moderation enforcement failed', {
            scheduled_message_id: record.id,
            error: error instanceof Error ? error.message : 'Unknown enforcement error',
          });
        }
      }
      return failure;
    }

    sender = await getEntityOrNull(entities.User, record.sender_id);
    conversation = await getEntityOrNull(entities.Conversation, record.conversation_id);
    if (!sender) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'SENDER_UNAVAILABLE',
        now,
      );
    }
    if (!conversation) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'CONVERSATION_UNAVAILABLE',
        now,
      );
    }
    try {
      assertConversationMembership(record.sender_id, conversation);
    } catch {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'SENDER_NOT_MEMBER',
        now,
      );
    }
    const freshParticipantUsers = (await Promise.all(
      (conversation.participant_ids || []).map((id) => getEntityOrNull(entities.User, id)),
    )).filter((participant): participant is MessageUser => participant !== null);
    const freshSafetyFailure = senderSafetyFailure(
      sender,
      conversation,
      freshParticipantUsers,
      dependencies.clock?.() || new Date(),
    );
    if (freshSafetyFailure) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        freshSafetyFailure,
        now,
      );
    }
    const freshAccess = await resolveAccess(
      entities.Subscription,
      record.sender_id,
      (dependencies.clock?.() || new Date()).toISOString(),
    );
    if (!freshAccess.entitlements[SCHEDULE_ENTITLEMENT]) {
      return markFailed(
        entities.ScheduledMessage,
        record,
        claimToken,
        'ENTITLEMENT_REVOKED',
        now,
      );
    }
    const beforeCreate = dependencies.clock?.() || new Date();
    const ownsCreate = await renewScheduledClaim(
      entities.ScheduledMessage,
      record,
      claimToken,
      beforeCreate,
    );
    if (!ownsCreate) return { id: record.id, outcome: 'claim_lost' };

    deliveredMessage = await entities.Message.create({
      conversation_id: record.conversation_id,
      sender_id: sender.id,
      sender_name: sender.display_name || sender.full_name,
      sender_avatar: sender.avatar_url,
      text: record.payload.text,
      type: 'text',
      participant_ids: conversation.participant_ids || [],
      read_by: [],
      scheduled_message_id: record.id,
    });
  }

  return reconcileClaimedScheduledDelivery({
    entities,
    record,
    claimToken,
    now,
  });
}

export async function reconcileClaimedScheduledDelivery({
  entities,
  record,
  claimToken,
  now,
  messages,
}: {
  entities: DeliveryEntities;
  record: ScheduledRecord;
  claimToken: string;
  now: Date;
  messages?: Array<Record<string, unknown> & { id: string; created_date?: string }>;
}) {
  const reconciled = messages || await entities.Message.filter(
    { scheduled_message_id: record.id },
    'created_date',
    10,
  );
  if (!reconciled.length) return null;

  const deliveredMessage = reconciled[0];
  for (const duplicate of reconciled.slice(1)) {
    try {
      await entities.Message.delete(String(duplicate.id));
    } catch (error) {
      console.error('Scheduled message duplicate cleanup failed', {
        scheduled_message_id: record.id,
        duplicate_message_id: duplicate.id,
        error: error instanceof Error ? error.message : 'Unknown duplicate cleanup error',
      });
    }
  }

  const sentAt = typeof deliveredMessage.created_date === 'string'
    ? deliveredMessage.created_date
    : now.toISOString();
  const finalized = await transitionClaim(entities.ScheduledMessage, record, claimToken, {
    status: 'sent',
    sent_at: sentAt,
    resulting_message_id: deliveredMessage.id,
    preview_pending: true,
    updated_at: now.toISOString(),
    failure_code: null,
    claim_token: null,
    claim_expires_at: null,
  });
  if (!finalized) return { id: record.id, outcome: 'claim_lost' };

  try {
    await repairScheduledMessagePreview(entities, {
      ...record,
      status: 'sent',
      sent_at: sentAt,
      resulting_message_id: String(deliveredMessage.id),
      preview_pending: true,
    });
  } catch (error) {
    console.error('Scheduled message preview update failed', {
      scheduled_message_id: record.id,
      error: error instanceof Error ? error.message : 'Unknown preview error',
    });
  }
  return { id: record.id, outcome: 'sent', message_id: deliveredMessage.id };
}

export async function repairScheduledMessagePreview(
  entities: DeliveryEntities,
  record: ScheduledRecord,
): Promise<boolean> {
  if (record.status !== 'sent' || !record.preview_pending || !record.sent_at) {
    return false;
  }
  const conversation = await getEntityOrNull(
    entities.Conversation,
    record.conversation_id,
  );
  if (conversation) {
    await entities.Conversation.updateMany(
      {
        id: record.conversation_id,
        $or: [
          { last_message_at: { $exists: false } },
          { last_message_at: null },
          { last_message_at: { $lte: record.sent_at } },
        ],
      },
      {
        $set: {
          last_message_text: record.payload.text,
          last_message_at: record.sent_at,
        },
      },
    );
  }
  const cleared = await entities.ScheduledMessage.updateMany(
    { id: record.id, status: 'sent', preview_pending: true },
    { $set: { preview_pending: false, updated_at: new Date().toISOString() } },
  );
  return cleared.updated === 1;
}

export async function releaseClaimForRetry({
  entity,
  record,
  claimToken,
  now,
  allowExhaustion = true,
}: {
  entity: ScheduledEntity;
  record: ScheduledRecord;
  claimToken: string;
  now: Date;
  allowExhaustion?: boolean;
}) {
  const attempts = Number(record.attempt_count || 0);
  if (allowExhaustion && attempts >= MAX_DELIVERY_ATTEMPTS) {
    return markFailed(
      entity,
      record,
      claimToken,
      'DELIVERY_RETRY_EXHAUSTED',
      now,
    );
  }
  await transitionClaim(entity, record, claimToken, {
    status: 'scheduled',
    dispatch_after: new Date(now.getTime() + retryDelayMs(attempts)).toISOString(),
    updated_at: now.toISOString(),
    claim_token: null,
    claim_expires_at: null,
  });
  return { id: record.id, outcome: 'retrying' };
}
