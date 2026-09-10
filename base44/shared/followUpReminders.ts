import { resolveUserSubscription } from './subscriptionAccess.ts';

export const FOLLOW_UP_ENTITLEMENT = 'reminders.follow_up';
export const MAX_REMINDER_DELAY_MS = 365 * 24 * 60 * 60 * 1000;
export const REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

type ReminderStatus = 'scheduled' | 'completed' | 'canceled' | 'triggered' | 'failed';

export interface FollowUpReminderRecord {
  id: string;
  owner_id: string;
  conversation_id: string;
  source_message_id: string;
  source_message_created_at: string;
  remind_at: string;
  status: ReminderStatus;
  resolution_reason?: string | null;
  client_request_key: string;
  scheduled_at: string;
  resolved_at?: string | null;
  canceled_at?: string | null;
  triggered_at?: string | null;
  failed_at?: string | null;
  last_attempt_at?: string | null;
  delivery_claim_key?: string | null;
  delivery_notification_id?: string | null;
  created_date?: string;
  updated_date?: string;
}

interface Entity<T extends { id: string }> {
  filter(
    query: Record<string, unknown>,
    sort?: string,
    limit?: number,
    skip?: number,
  ): Promise<T[]>;
  create(data: Omit<T, 'id'>): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
}

interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_id: string;
  created_date?: string;
}

interface ConversationRecord {
  id: string;
  type?: string;
  participant_ids?: string[];
}

interface UserRecord {
  id: string;
  is_banned?: boolean;
  timeout_until?: string | null;
}

interface NotificationRecord {
  id: string;
  follow_up_reminder_id?: string;
}

export interface ReminderEntities {
  FollowUpReminder: Entity<FollowUpReminderRecord>;
  Message: Entity<MessageRecord>;
  Conversation: Entity<ConversationRecord>;
  User: Entity<UserRecord>;
  Notification: Entity<NotificationRecord>;
  Subscription: Parameters<typeof resolveUserSubscription>[0];
}

export class FollowUpReminderError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'FollowUpReminderError';
    this.status = status;
    this.code = code;
  }
}

function asDate(value: unknown, field: string): Date {
  const date = new Date(typeof value === 'string' ? value : '');
  if (!Number.isFinite(date.getTime())) {
    throw new FollowUpReminderError(400, 'INVALID_DATE', `${field} must be a valid date-time.`);
  }
  return date;
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new FollowUpReminderError(400, 'INVALID_REQUEST', `${field} is required.`);
  }
  return value.trim();
}

function currentDate(now: string | Date): Date {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid reminder clock');
  return date;
}

async function findById<T extends { id: string }>(
  entity: Pick<Entity<T>, 'filter'>,
  id: string,
): Promise<T | null> {
  const matches = await entity.filter({ id }, '-created_date', 1, 0);
  return matches[0] || null;
}

async function loadAll<T extends { id: string }>(
  entity: Pick<Entity<T>, 'filter'>,
  query: Record<string, unknown>,
): Promise<T[]> {
  const records: T[] = [];
  const pageSize = 500;
  for (let skip = 0; ; skip += pageSize) {
    const page = await entity.filter(query, '-created_date', pageSize, skip);
    records.push(...page);
    if (page.length < pageSize) return records;
  }
}

function isOwnerBlocked(user: UserRecord, now: Date): boolean {
  if (user.is_banned) return true;
  if (!user.timeout_until) return false;
  const timeout = Date.parse(user.timeout_until);
  return Number.isFinite(timeout) && timeout > now.getTime();
}

async function requireEntitlement(
  entities: Pick<ReminderEntities, 'Subscription'>,
  ownerId: string,
  now: Date,
) {
  const access = await resolveUserSubscription(
    entities.Subscription,
    ownerId,
    now.toISOString(),
  );
  if (!access.entitlements[FOLLOW_UP_ENTITLEMENT]) {
    throw new FollowUpReminderError(
      403,
      'FOLLOW_UP_ENTITLEMENT_REQUIRED',
      'Premium Plus is required for follow-up reminders.',
    );
  }
}

function validateRemindAt(remindAt: unknown, now: Date): string {
  const date = asDate(remindAt, 'remind_at');
  if (date.getTime() <= now.getTime()) {
    throw new FollowUpReminderError(
      400,
      'REMINDER_TIME_IN_PAST',
      'Reminder time must be in the future.',
    );
  }
  if (date.getTime() - now.getTime() > MAX_REMINDER_DELAY_MS) {
    throw new FollowUpReminderError(
      400,
      'REMINDER_TIME_TOO_FAR',
      'Reminder time must be within one year.',
    );
  }
  return date.toISOString();
}

function validateRequestKey(requestKey: unknown): string {
  const value = typeof requestKey === 'string' ? requestKey : '';
  if (!REQUEST_KEY_PATTERN.test(value)) {
    throw new FollowUpReminderError(
      400,
      'INVALID_REQUEST_KEY',
      'client_request_key must contain 8-128 safe characters.',
    );
  }
  return value;
}

function isLaterRecipientReply(
  message: MessageRecord,
  ownerId: string,
  sourceCreatedAt: string,
  participantIds: readonly string[],
): boolean {
  if (message.sender_id === ownerId || !participantIds.includes(message.sender_id)) return false;
  const messageAt = Date.parse(message.created_date || '');
  const sourceAt = Date.parse(sourceCreatedAt);
  return Number.isFinite(messageAt) && Number.isFinite(sourceAt) && messageAt > sourceAt;
}

async function findLaterRecipientReply(
  messageEntity: Pick<Entity<MessageRecord>, 'filter'>,
  reminder: Pick<
    FollowUpReminderRecord,
    'conversation_id' | 'owner_id' | 'source_message_created_at'
  >,
  participantIds: readonly string[],
): Promise<MessageRecord | null> {
  const messages = await loadAll(messageEntity, {
    conversation_id: reminder.conversation_id,
  });
  return messages.find((message) => isLaterRecipientReply(
    message,
    reminder.owner_id,
    reminder.source_message_created_at,
    participantIds,
  )) || null;
}

function sameCreateRequest(
  reminder: FollowUpReminderRecord,
  sourceMessageId: string,
  remindAt: string,
): boolean {
  return reminder.source_message_id === sourceMessageId && reminder.remind_at === remindAt;
}

function analyticsDelayBucket(remindAt: string, now: Date): string {
  const delayHours = (Date.parse(remindAt) - now.getTime()) / (60 * 60 * 1000);
  if (delayHours <= 1) return 'under_1h';
  if (delayHours <= 24) return '1h_to_24h';
  if (delayHours <= 168) return '1d_to_7d';
  return 'over_7d';
}

export function logFollowUpAnalytics(
  event: string,
  properties: Record<string, string | number | boolean | null | undefined> = {},
) {
  const safeKeys = new Set(['outcome', 'reason', 'conversation_type', 'delay_bucket']);
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => (
      safeKeys.has(key)
      && (value === null || ['string', 'number', 'boolean'].includes(typeof value))
    )),
  );
  console.info(JSON.stringify({ event, ...safeProperties }));
}

export function messageIdFromEntityEvent(body: {
  event?: { entity_id?: unknown; id?: unknown };
  data?: { id?: unknown };
}): string | null {
  const candidate = body?.event?.entity_id || body?.event?.id || body?.data?.id;
  return typeof candidate === 'string' && candidate ? candidate : null;
}

export async function createFollowUpReminder({
  entities,
  user,
  sourceMessageId: rawSourceMessageId,
  remindAt: rawRemindAt,
  requestKey: rawRequestKey,
  now = new Date(),
}: {
  entities: ReminderEntities;
  user: UserRecord | null;
  sourceMessageId: unknown;
  remindAt: unknown;
  requestKey: unknown;
  now?: string | Date;
}) {
  if (!user) throw new FollowUpReminderError(401, 'UNAUTHORIZED', 'Unauthorized.');
  const clock = currentDate(now);
  if (isOwnerBlocked(user, clock)) {
    throw new FollowUpReminderError(403, 'OWNER_BLOCKED', 'This account cannot create reminders.');
  }
  await requireEntitlement(entities, user.id, clock);

  const sourceMessageId = requireId(rawSourceMessageId, 'source_message_id');
  const remindAt = validateRemindAt(rawRemindAt, clock);
  const requestKey = validateRequestKey(rawRequestKey);
  const duplicates = await entities.FollowUpReminder.filter({
    owner_id: user.id,
    client_request_key: requestKey,
  }, '-created_date', 2, 0);
  if (duplicates.length > 0) {
    const duplicate = duplicates[0];
    if (!sameCreateRequest(duplicate, sourceMessageId, remindAt)) {
      throw new FollowUpReminderError(
        409,
        'REQUEST_KEY_REUSED',
        'This request key was already used for a different reminder.',
      );
    }
    return { reminder: duplicate, duplicate: true };
  }
  const activeForSource = await entities.FollowUpReminder.filter({
    owner_id: user.id,
    source_message_id: sourceMessageId,
    status: 'scheduled',
  }, '-created_date', 1, 0);
  if (activeForSource.length > 0) {
    throw new FollowUpReminderError(
      409,
      'REMINDER_ALREADY_SCHEDULED',
      'This message already has a scheduled follow-up reminder.',
    );
  }

  const source = await findById(entities.Message, sourceMessageId);
  if (!source) {
    throw new FollowUpReminderError(404, 'SOURCE_MESSAGE_NOT_FOUND', 'Source message not found.');
  }
  if (source.sender_id !== user.id) {
    throw new FollowUpReminderError(
      403,
      'SOURCE_MESSAGE_NOT_OWNED',
      'Only your own sent messages can have follow-up reminders.',
    );
  }
  const sourceCreatedAt = asDate(source.created_date, 'source message timestamp').toISOString();
  const conversation = await findById(entities.Conversation, source.conversation_id);
  if (!conversation) {
    throw new FollowUpReminderError(404, 'CONVERSATION_NOT_FOUND', 'Conversation not found.');
  }
  if (!conversation.participant_ids?.includes(user.id)) {
    throw new FollowUpReminderError(403, 'NOT_A_PARTICIPANT', 'Conversation membership is required.');
  }
  if (!conversation.participant_ids.some((participantId) => participantId !== user.id)) {
    throw new FollowUpReminderError(
      400,
      'NO_RECIPIENT',
      'A follow-up reminder requires at least one other participant.',
    );
  }

  const provisional = {
    conversation_id: source.conversation_id,
    owner_id: user.id,
    source_message_created_at: sourceCreatedAt,
  };
  if (await findLaterRecipientReply(
    entities.Message,
    provisional,
    conversation.participant_ids,
  )) {
    throw new FollowUpReminderError(
      409,
      'RECIPIENT_ALREADY_REPLIED',
      'A recipient has already replied to this message.',
    );
  }

  let reminder = await entities.FollowUpReminder.create({
    owner_id: user.id,
    conversation_id: source.conversation_id,
    source_message_id: source.id,
    source_message_created_at: sourceCreatedAt,
    remind_at: remindAt,
    status: 'scheduled',
    resolution_reason: null,
    client_request_key: requestKey,
    scheduled_at: clock.toISOString(),
    resolved_at: null,
    canceled_at: null,
    triggered_at: null,
    failed_at: null,
    last_attempt_at: null,
    delivery_claim_key: null,
    delivery_notification_id: null,
  });

  // Close the check/create race if a recipient message landed while the reminder was created.
  if (await findLaterRecipientReply(
    entities.Message,
    reminder,
    conversation.participant_ids,
  )) {
    reminder = await entities.FollowUpReminder.update(reminder.id, {
      status: 'completed',
      resolution_reason: 'recipient_reply',
      resolved_at: clock.toISOString(),
    });
  }

  logFollowUpAnalytics('follow_up_reminder_created', {
    outcome: reminder.status,
    conversation_type: conversation.type || 'unknown',
    delay_bucket: analyticsDelayBucket(remindAt, clock),
  });
  return { reminder, duplicate: false };
}

async function cancelIneligibleOwnerReminders(
  entities: ReminderEntities,
  ownerId: string,
  now: Date,
  reason: 'owner_blocked' | 'owner_ineligible',
) {
  const reminders = await loadAll(entities.FollowUpReminder, {
    owner_id: ownerId,
    status: 'scheduled',
  });
  await Promise.all(reminders.map((reminder) => entities.FollowUpReminder.update(reminder.id, {
    status: 'canceled',
    resolution_reason: reason,
    canceled_at: now.toISOString(),
  })));
}

export async function listFollowUpReminders({
  entities,
  user,
  now = new Date(),
}: {
  entities: ReminderEntities;
  user: UserRecord | null;
  now?: string | Date;
}) {
  if (!user) throw new FollowUpReminderError(401, 'UNAUTHORIZED', 'Unauthorized.');
  const clock = currentDate(now);
  if (isOwnerBlocked(user, clock)) {
    await cancelIneligibleOwnerReminders(entities, user.id, clock, 'owner_blocked');
    throw new FollowUpReminderError(403, 'OWNER_BLOCKED', 'This account cannot use reminders.');
  }
  try {
    await requireEntitlement(entities, user.id, clock);
  } catch (error) {
    if (
      error instanceof FollowUpReminderError
      && error.code === 'FOLLOW_UP_ENTITLEMENT_REQUIRED'
    ) {
      await cancelIneligibleOwnerReminders(entities, user.id, clock, 'owner_ineligible');
    }
    throw error;
  }
  const reminders = await loadAll(entities.FollowUpReminder, { owner_id: user.id });
  for (let index = 0; index < reminders.length; index++) {
    const reminder = reminders[index];
    if (reminder.status !== 'scheduled') continue;
    const conversation = await findById(entities.Conversation, reminder.conversation_id);
    if (!conversation) {
      reminders[index] = await entities.FollowUpReminder.update(reminder.id, {
        status: 'canceled',
        resolution_reason: 'conversation_deleted',
        canceled_at: clock.toISOString(),
      });
      continue;
    }
    if (!conversation.participant_ids?.includes(user.id)) {
      reminders[index] = await entities.FollowUpReminder.update(reminder.id, {
        status: 'canceled',
        resolution_reason: 'membership_removed',
        canceled_at: clock.toISOString(),
      });
      continue;
    }
    const source = await findById(entities.Message, reminder.source_message_id);
    if (
      !source
      || source.sender_id !== user.id
      || source.conversation_id !== reminder.conversation_id
    ) {
      reminders[index] = await entities.FollowUpReminder.update(reminder.id, {
        status: 'canceled',
        resolution_reason: 'source_deleted',
        canceled_at: clock.toISOString(),
      });
      continue;
    }
    if (await findLaterRecipientReply(
      entities.Message,
      reminder,
      conversation.participant_ids,
    )) {
      reminders[index] = await entities.FollowUpReminder.update(reminder.id, {
        status: 'completed',
        resolution_reason: 'recipient_reply',
        resolved_at: clock.toISOString(),
      });
    }
  }
  return reminders.sort((left, right) => Date.parse(right.remind_at) - Date.parse(left.remind_at));
}

async function requireOwnedScheduledReminder(
  entity: Entity<FollowUpReminderRecord>,
  reminderId: unknown,
  ownerId: string,
) {
  const id = requireId(reminderId, 'reminder_id');
  const reminder = await findById(entity, id);
  if (!reminder) {
    throw new FollowUpReminderError(404, 'REMINDER_NOT_FOUND', 'Reminder not found.');
  }
  if (reminder.owner_id !== ownerId) {
    throw new FollowUpReminderError(403, 'NOT_REMINDER_OWNER', 'Reminder ownership is required.');
  }
  if (reminder.status !== 'scheduled') {
    throw new FollowUpReminderError(
      409,
      'REMINDER_NOT_SCHEDULED',
      'Only scheduled reminders can be changed.',
    );
  }
  return reminder;
}

async function requireCurrentReminderContext(
  entities: ReminderEntities,
  reminder: FollowUpReminderRecord,
  ownerId: string,
) {
  const conversation = await findById(entities.Conversation, reminder.conversation_id);
  if (!conversation) {
    throw new FollowUpReminderError(409, 'CONVERSATION_NOT_FOUND', 'Conversation no longer exists.');
  }
  return conversation;
  if (!conversation.participant_ids?.includes(ownerId)) {
    throw new FollowUpReminderError(403, 'NOT_A_PARTICIPANT', 'Conversation membership is required.');
  }
  const source = await findById(entities.Message, reminder.source_message_id);
  if (
    !source
    || source.sender_id !== ownerId
    || source.conversation_id !== reminder.conversation_id
  ) {
    throw new FollowUpReminderError(
      409,
      'SOURCE_MESSAGE_NOT_FOUND',
      'Source message no longer exists.',
    );
  }
}

export async function rescheduleFollowUpReminder({
  entities,
  user,
  reminderId,
  remindAt,
  now = new Date(),
}: {
  entities: ReminderEntities;
  user: UserRecord | null;
  reminderId: unknown;
  remindAt: unknown;
  now?: string | Date;
}) {
  if (!user) throw new FollowUpReminderError(401, 'UNAUTHORIZED', 'Unauthorized.');
  const clock = currentDate(now);
  if (isOwnerBlocked(user, clock)) {
    throw new FollowUpReminderError(403, 'OWNER_BLOCKED', 'This account cannot use reminders.');
  }
  await requireEntitlement(entities, user.id, clock);
  const reminder = await requireOwnedScheduledReminder(
    entities.FollowUpReminder,
    reminderId,
    user.id,
  );
  const conversation = await requireCurrentReminderContext(entities, reminder, user.id);
  if (await findLaterRecipientReply(
    entities.Message,
    reminder,
    conversation.participant_ids || [],
  )) {
    await entities.FollowUpReminder.update(reminder.id, {
      status: 'completed',
      resolution_reason: 'recipient_reply',
      resolved_at: clock.toISOString(),
    });
    throw new FollowUpReminderError(
      409,
      'RECIPIENT_ALREADY_REPLIED',
      'A recipient has already replied to this message.',
    );
  }
  const nextRemindAt = validateRemindAt(remindAt, clock);
  const updated = await entities.FollowUpReminder.update(reminder.id, {
    remind_at: nextRemindAt,
    scheduled_at: clock.toISOString(),
    resolution_reason: null,
  });
  logFollowUpAnalytics('follow_up_reminder_rescheduled', {
    outcome: 'scheduled',
    delay_bucket: analyticsDelayBucket(nextRemindAt, clock),
  });
  return updated;
}

export async function cancelFollowUpReminder({
  entities,
  user,
  reminderId,
  now = new Date(),
}: {
  entities: ReminderEntities;
  user: UserRecord | null;
  reminderId: unknown;
  now?: string | Date;
}) {
  if (!user) throw new FollowUpReminderError(401, 'UNAUTHORIZED', 'Unauthorized.');
  const clock = currentDate(now);
  const id = requireId(reminderId, 'reminder_id');
  const existing = await findById(entities.FollowUpReminder, id);
  if (!existing) {
    throw new FollowUpReminderError(404, 'REMINDER_NOT_FOUND', 'Reminder not found.');
  }
  if (existing.owner_id !== user.id) {
    throw new FollowUpReminderError(403, 'NOT_REMINDER_OWNER', 'Reminder ownership is required.');
  }
  if (existing.status === 'canceled' && existing.resolution_reason === 'user_canceled') {
    return existing;
  }
  if (isOwnerBlocked(user, clock)) {
    throw new FollowUpReminderError(403, 'OWNER_BLOCKED', 'This account cannot use reminders.');
  }
  await requireEntitlement(entities, user.id, clock);
  const reminder = await requireOwnedScheduledReminder(entities.FollowUpReminder, id, user.id);
  await requireCurrentReminderContext(entities, reminder, user.id);
  const updated = await entities.FollowUpReminder.update(reminder.id, {
    status: 'canceled',
    resolution_reason: 'user_canceled',
    canceled_at: clock.toISOString(),
  });
  logFollowUpAnalytics('follow_up_reminder_canceled', {
    outcome: 'canceled',
    reason: 'user_canceled',
  });
  return updated;
}

export async function resolveFollowUpRemindersForMessage({
  entities,
  message,
  now = new Date(),
}: {
  entities: Pick<ReminderEntities, 'FollowUpReminder' | 'Conversation'>;
  message: MessageRecord;
  now?: string | Date;
}) {
  if (!message.conversation_id || !message.sender_id || !message.created_date) return 0;
  const clock = currentDate(now);
  const conversation = await findById(entities.Conversation, message.conversation_id);
  if (!conversation?.participant_ids?.includes(message.sender_id)) return 0;
  const reminders = await loadAll(entities.FollowUpReminder, {
    conversation_id: message.conversation_id,
    status: 'scheduled',
  });
  let completed = 0;
  for (const reminder of reminders) {
    if (!isLaterRecipientReply(
      message,
      reminder.owner_id,
      reminder.source_message_created_at,
      conversation.participant_ids,
    )) {
      continue;
    }
    const current = await findById(entities.FollowUpReminder, reminder.id);
    if (current?.status !== 'scheduled') continue;
    await entities.FollowUpReminder.update(reminder.id, {
      status: 'completed',
      resolution_reason: 'recipient_reply',
      resolved_at: clock.toISOString(),
    });
    completed++;
  }
  if (completed > 0) {
    logFollowUpAnalytics('follow_up_reminder_resolved', {
      outcome: 'completed',
      reason: 'recipient_reply',
    });
  }
  return completed;
}

async function cancelForReason(
  entity: Entity<FollowUpReminderRecord>,
  reminder: FollowUpReminderRecord,
  reason: 'source_deleted' | 'conversation_deleted' | 'membership_removed'
    | 'owner_blocked' | 'owner_ineligible',
  now: Date,
) {
  const current = await findById(entity, reminder.id);
  if (current?.status !== 'scheduled') return false;
  await entity.update(reminder.id, {
    status: 'canceled',
    resolution_reason: reason,
    canceled_at: now.toISOString(),
  });
  logFollowUpAnalytics('follow_up_reminder_canceled', {
    outcome: 'canceled',
    reason,
  });
  return true;
}

export async function processDueFollowUpReminders({
  entities,
  now = new Date(),
}: {
  entities: ReminderEntities;
  now?: string | Date;
}) {
  const clock = currentDate(now);
  const scheduled = await loadAll(entities.FollowUpReminder, { status: 'scheduled' });
  const claimed = await loadAll(entities.FollowUpReminder, { status: 'triggered' });
  const staleClaimCutoff = clock.getTime() - 5 * 60 * 1000;
  const recoverableClaims = claimed.filter((reminder) => (
    !reminder.triggered_at
    && Date.parse(reminder.last_attempt_at || '') <= staleClaimCutoff
  ));
  for (const reminder of recoverableClaims) {
    const notifications = await entities.Notification.filter({
      follow_up_reminder_id: reminder.id,
    }, '-created_date', 1, 0);
    if (notifications[0]) {
      await entities.FollowUpReminder.update(reminder.id, {
        triggered_at: clock.toISOString(),
        delivery_notification_id: notifications[0].id,
      });
    } else {
      await entities.FollowUpReminder.update(reminder.id, {
        status: 'scheduled',
        delivery_claim_key: null,
      });
      scheduled.push({ ...reminder, status: 'scheduled', delivery_claim_key: null });
    }
  }
  const due = scheduled.filter((reminder) => Date.parse(reminder.remind_at) <= clock.getTime());
  const summary = { due: due.length, triggered: 0, canceled: 0, completed: 0, failed: 0 };

  for (const candidate of due) {
    let reminder = await findById(entities.FollowUpReminder, candidate.id);
    if (reminder?.status !== 'scheduled') continue;

    const owner = await findById(entities.User, reminder.owner_id);
    if (!owner || isOwnerBlocked(owner, clock)) {
      if (await cancelForReason(
        entities.FollowUpReminder,
        reminder,
        'owner_blocked',
        clock,
      )) summary.canceled++;
      continue;
    }
    try {
      await requireEntitlement(entities, owner.id, clock);
    } catch (error) {
      if (
        error instanceof FollowUpReminderError
        && error.code === 'FOLLOW_UP_ENTITLEMENT_REQUIRED'
      ) {
        if (await cancelForReason(
          entities.FollowUpReminder,
          reminder,
          'owner_ineligible',
          clock,
        )) summary.canceled++;
        continue;
      }
      throw error;
    }

    const conversation = await findById(entities.Conversation, reminder.conversation_id);
    if (!conversation) {
      if (await cancelForReason(
        entities.FollowUpReminder,
        reminder,
        'conversation_deleted',
        clock,
      )) summary.canceled++;
      continue;
    }
    if (!conversation.participant_ids?.includes(reminder.owner_id)) {
      if (await cancelForReason(
        entities.FollowUpReminder,
        reminder,
        'membership_removed',
        clock,
      )) summary.canceled++;
      continue;
    }

    const source = await findById(entities.Message, reminder.source_message_id);
    if (
      !source
      || source.sender_id !== reminder.owner_id
      || source.conversation_id !== reminder.conversation_id
    ) {
      if (await cancelForReason(
        entities.FollowUpReminder,
        reminder,
        'source_deleted',
        clock,
      )) summary.canceled++;
      continue;
    }
    if (await findLaterRecipientReply(
      entities.Message,
      reminder,
      conversation.participant_ids || [],
    )) {
      reminder = await findById(entities.FollowUpReminder, reminder.id);
      if (reminder?.status === 'scheduled') {
        await entities.FollowUpReminder.update(reminder.id, {
          status: 'completed',
          resolution_reason: 'recipient_reply',
          resolved_at: clock.toISOString(),
        });
        summary.completed++;
      }
      continue;
    }

    // Base44 has no conditional update primitive. Claim before delivery, then
    // re-read the claim so duplicated scheduler runs cannot both notify.
    reminder = await findById(entities.FollowUpReminder, reminder.id);
    if (reminder?.status !== 'scheduled') continue;
    const deliveryClaimKey = `delivery:${crypto.randomUUID()}`;
    await entities.FollowUpReminder.update(reminder.id, {
      status: 'triggered',
      triggered_at: clock.toISOString(),
      last_attempt_at: clock.toISOString(),
      delivery_claim_key: deliveryClaimKey,
    });
    const claimed = await findById(entities.FollowUpReminder, reminder.id);
    if (
      claimed?.status !== 'triggered'
      || claimed.delivery_claim_key !== deliveryClaimKey
    ) continue;

    try {
      const notification = await entities.Notification.create({
        recipient_id: reminder.owner_id,
        type: 'follow_up_reminder',
        actor_id: reminder.owner_id,
        actor_name: 'Follow-up reminder',
        message: 'No one has replied to your message yet.',
        link: `/messages?id=${encodeURIComponent(reminder.conversation_id)}`,
        read: false,
        follow_up_reminder_id: reminder.id,
      } as unknown as Omit<NotificationRecord, 'id'>);
      const current = await findById(entities.FollowUpReminder, reminder.id);
      if (
        current?.status === 'triggered'
        && current.delivery_claim_key === deliveryClaimKey
      ) {
        await entities.FollowUpReminder.update(reminder.id, {
          triggered_at: clock.toISOString(),
          delivery_notification_id: notification.id,
        });
      }
      summary.triggered++;
      logFollowUpAnalytics('follow_up_reminder_triggered', { outcome: 'triggered' });
    } catch (error) {
      const current = await findById(entities.FollowUpReminder, reminder.id);
      if (current?.status === 'triggered') {
        await entities.FollowUpReminder.update(reminder.id, {
          status: 'failed',
          resolution_reason: 'notification_failed',
          failed_at: clock.toISOString(),
        });
      }
      summary.failed++;
      logFollowUpAnalytics('follow_up_reminder_failed', {
        outcome: 'failed',
        reason: 'notification_failed',
      });
      console.error('Follow-up reminder notification failed:', error);
    }
  }
  return summary;
}

export function followUpReminderErrorResponse(error: unknown): Response {
  if (error instanceof FollowUpReminderError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  const message = error instanceof Error ? error.message : 'Unable to process follow-up reminder.';
  return Response.json({ error: message }, { status: 500 });
}
