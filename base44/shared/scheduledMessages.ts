export const SCHEDULE_ENTITLEMENT = 'messages.schedule';
export const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;
export const MAX_SCHEDULE_AHEAD_MS = 365 * 24 * 60 * 60 * 1000;
export const CLAIM_LEASE_MS = 6 * 60 * 1000;
export const CREATE_LEASE_MS = 6 * 60 * 1000;
export const MAX_DELIVERY_ATTEMPTS = 5;
export const MAX_SCHEDULED_TEXT_LENGTH = 4000;
export const MAX_ACTIVE_SCHEDULES_PER_USER = 25;

export type ScheduledStatus = 'scheduled' | 'processing' | 'sent' | 'canceled' | 'failed';
export type ScheduledFailureCode =
  | 'ENTITLEMENT_REVOKED'
  | 'SENDER_UNAVAILABLE'
  | 'SENDER_NOT_MEMBER'
  | 'SENDER_BANNED'
  | 'SENDER_TIMED_OUT'
  | 'CONVERSATION_UNAVAILABLE'
  | 'MODERATION_REJECTED'
  | 'DELIVERY_RETRY_EXHAUSTED';

export interface ScheduledPayload {
  type: 'text';
  text: string;
}

export interface ScheduledRecord extends Record<string, unknown> {
  id: string;
  sender_id: string;
  conversation_id: string;
  payload: ScheduledPayload;
  scheduled_at: string;
  dispatch_after: string;
  status: ScheduledStatus;
  client_request_key: string;
  created_at: string;
  updated_at: string;
  sent_at?: string | null;
  resulting_message_id?: string | null;
  failure_code?: ScheduledFailureCode | null;
  claim_token?: string | null;
  claim_expires_at?: string | null;
  attempt_count?: number;
  preview_pending?: boolean;
}

export interface MessageUser extends Record<string, unknown> {
  id: string;
  role?: string;
  display_name?: string;
  full_name?: string;
  avatar_url?: string;
  is_banned?: boolean;
  timeout_until?: string | null;
  violation_count?: number;
}

export interface MessageConversation extends Record<string, unknown> {
  id: string;
  participant_ids?: string[];
}

export class ScheduledMessageError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'ScheduledMessageError';
    this.code = code;
    this.status = status;
  }
}

export function sanitizeScheduledPayload(value: unknown): ScheduledPayload {
  const payload = value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
  if (payload.type !== 'text') {
    throw new ScheduledMessageError(
      'UNSUPPORTED_MESSAGE_TYPE',
      'Only text messages can be scheduled.',
    );
  }
  if (typeof payload.text !== 'string') {
    throw new ScheduledMessageError('INVALID_MESSAGE', 'Message text is required.');
  }

  const text = payload.text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
  if (!text) {
    throw new ScheduledMessageError('INVALID_MESSAGE', 'Message text is required.');
  }
  if (text.length > MAX_SCHEDULED_TEXT_LENGTH) {
    throw new ScheduledMessageError(
      'MESSAGE_TOO_LONG',
      `Scheduled messages are limited to ${MAX_SCHEDULED_TEXT_LENGTH} characters.`,
    );
  }
  return { type: 'text', text };
}

export function validateClientRequestKey(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) {
    throw new ScheduledMessageError(
      'INVALID_CLIENT_REQUEST_KEY',
      'A valid client request key is required.',
    );
  }
  return value;
}

export function normalizeScheduleInstant(value: unknown): string {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new ScheduledMessageError(
      'INVALID_SCHEDULE_TIME',
      'Schedule time must be an ISO 8601 instant with a UTC offset.',
    );
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new ScheduledMessageError('INVALID_SCHEDULE_TIME', 'Schedule time is invalid.');
  }
  return new Date(timestamp).toISOString();
}

export function validateScheduleInstant(value: unknown, now = new Date()): string {
  const normalized = normalizeScheduleInstant(value);
  const timestamp = Date.parse(normalized);
  if (timestamp < now.getTime() + MIN_SCHEDULE_LEAD_MS) {
    throw new ScheduledMessageError(
      'SCHEDULE_TOO_SOON',
      'Choose a time at least 5 minutes from now.',
    );
  }
  if (timestamp > now.getTime() + MAX_SCHEDULE_AHEAD_MS) {
    throw new ScheduledMessageError(
      'SCHEDULE_TOO_FAR',
      'Choose a time within the next 365 days.',
    );
  }
  return normalized;
}

export function assertConversationMembership(
  userId: string,
  conversation: MessageConversation | null | undefined,
): asserts conversation is MessageConversation {
  if (!conversation) {
    throw new ScheduledMessageError(
      'CONVERSATION_UNAVAILABLE',
      'The conversation is no longer available.',
      404,
    );
  }
  if (!conversation.participant_ids?.includes(userId)) {
    throw new ScheduledMessageError(
      'SENDER_NOT_MEMBER',
      'You are no longer a member of this conversation.',
      403,
    );
  }
}

export function senderSafetyFailure(
  user: MessageUser,
  conversation: MessageConversation,
  participantUsers: MessageUser[],
  now = new Date(),
): ScheduledFailureCode | null {
  if (user.timeout_until) {
    const timeoutUntil = Date.parse(user.timeout_until);
    if (Number.isFinite(timeoutUntil) && timeoutUntil > now.getTime()) {
      return 'SENDER_TIMED_OUT';
    }
  }
  if (user.is_banned) {
    const hasAdmin = conversation.participant_ids?.some((id) => (
      id !== user.id && participantUsers.some((participant) => (
        participant.id === id && participant.role === 'admin'
      ))
    ));
    if (!hasAdmin) return 'SENDER_BANNED';
  }
  return null;
}

export function requestsMatch(
  record: ScheduledRecord,
  conversationId: string,
  payload: ScheduledPayload,
  scheduledAt: string,
): boolean {
  return record.conversation_id === conversationId
    && record.scheduled_at === scheduledAt
    && record.payload?.type === payload.type
    && record.payload?.text === payload.text;
}

export function publicScheduledMessage(record: ScheduledRecord) {
  return {
    id: record.id,
    conversation_id: record.conversation_id,
    payload: record.payload,
    scheduled_at: record.scheduled_at,
    status: record.status,
    client_request_key: record.client_request_key,
    created_at: record.created_at,
    updated_at: record.updated_at,
    sent_at: record.sent_at || null,
    resulting_message_id: record.resulting_message_id || null,
    failure_code: record.failure_code || null,
  };
}

function errorStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const response = Reflect.get(error, 'response');
  const responseStatus = response && typeof response === 'object'
    ? Reflect.get(response, 'status')
    : null;
  const status = Reflect.get(error, 'status') || responseStatus;
  return typeof status === 'number' ? status : null;
}

export async function getEntityOrNull<T extends Record<string, unknown>>(
  entity: { get(id: string): Promise<T> },
  id: string,
): Promise<T | null> {
  try {
    return await entity.get(id);
  } catch (error) {
    if (errorStatus(error) === 404) return null;
    throw error;
  }
}

interface ScheduledEntity {
  get(id: string): Promise<ScheduledRecord>;
  updateMany(
    query: Record<string, unknown>,
    update: Record<string, Record<string, unknown>>,
  ): Promise<{ updated: number }>;
}

interface UserLeaseEntity {
  updateMany(
    query: Record<string, unknown>,
    update: Record<string, Record<string, unknown>>,
  ): Promise<{ updated: number }>;
}

export async function acquireScheduledCreateLease(
  entity: UserLeaseEntity,
  userId: string,
  claimToken: string,
  now: Date,
): Promise<boolean> {
  const result = await entity.updateMany(
    {
      id: userId,
      $or: [
        { scheduled_message_create_claim_token: { $exists: false } },
        { scheduled_message_create_claim_token: null },
        { scheduled_message_create_claim_expires_at: { $lte: now.toISOString() } },
      ],
    },
    {
      $set: {
        scheduled_message_create_claim_token: claimToken,
        scheduled_message_create_claim_expires_at: new Date(
          now.getTime() + CREATE_LEASE_MS,
        ).toISOString(),
      },
    },
  );
  return result.updated === 1;
}

export async function releaseScheduledCreateLease(
  entity: UserLeaseEntity,
  userId: string,
  claimToken: string,
): Promise<void> {
  await entity.updateMany(
    { id: userId, scheduled_message_create_claim_token: claimToken },
    {
      $unset: {
        scheduled_message_create_claim_token: '',
        scheduled_message_create_claim_expires_at: '',
      },
    },
  );
}

export async function renewScheduledCreateLease(
  entity: UserLeaseEntity,
  userId: string,
  claimToken: string,
  now: Date,
): Promise<boolean> {
  const result = await entity.updateMany(
    { id: userId, scheduled_message_create_claim_token: claimToken },
    {
      $set: {
        scheduled_message_create_claim_expires_at: new Date(
          now.getTime() + CREATE_LEASE_MS,
        ).toISOString(),
      },
    },
  );
  return result.updated === 1;
}

export async function claimScheduledMessage(
  entity: ScheduledEntity,
  candidate: ScheduledRecord,
  now: Date,
  claimToken: string,
): Promise<ScheduledRecord | null> {
  const nowIso = now.toISOString();
  const claimQuery = candidate.status === 'scheduled'
    ? {
        id: candidate.id,
        status: 'scheduled',
        dispatch_after: { $lte: nowIso },
      }
    : {
        id: candidate.id,
        status: 'processing',
        claim_token: candidate.claim_token || null,
        claim_expires_at: { $lte: nowIso },
      };
  const claimed = await entity.updateMany(claimQuery, {
    $set: {
      status: 'processing',
      claim_token: claimToken,
      claim_expires_at: new Date(now.getTime() + CLAIM_LEASE_MS).toISOString(),
      updated_at: nowIso,
      failure_code: null,
    },
    $inc: { attempt_count: 1 },
  });
  if (claimed.updated !== 1) return null;

  const record = await entity.get(candidate.id);
  return record.status === 'processing' && record.claim_token === claimToken
    ? record
    : null;
}

export async function renewScheduledClaim(
  entity: ScheduledEntity,
  record: ScheduledRecord,
  claimToken: string,
  now: Date,
): Promise<boolean> {
  const renewed = await entity.updateMany(
    { id: record.id, status: 'processing', claim_token: claimToken },
    {
      $set: {
        claim_expires_at: new Date(now.getTime() + CLAIM_LEASE_MS).toISOString(),
        updated_at: now.toISOString(),
      },
    },
  );
  return renewed.updated === 1;
}

export async function transitionClaim(
  entity: ScheduledEntity,
  record: ScheduledRecord,
  claimToken: string,
  values: Record<string, unknown>,
): Promise<boolean> {
  const result = await entity.updateMany(
    { id: record.id, status: 'processing', claim_token: claimToken },
    { $set: values },
  );
  return result.updated === 1;
}

export async function cancelScheduledRecord(
  entity: ScheduledEntity,
  id: string,
  senderId: string,
  now: Date,
): Promise<boolean> {
  const result = await entity.updateMany(
    { id, sender_id: senderId, status: 'scheduled' },
    {
      $set: {
        status: 'canceled',
        updated_at: now.toISOString(),
        claim_token: null,
        claim_expires_at: null,
        failure_code: null,
      },
    },
  );
  return result.updated === 1;
}

export function retryDelayMs(attemptCount: number): number {
  return Math.min(15 * 60 * 1000, Math.max(1, attemptCount) * 60 * 1000);
}

export function selectFairDueCandidates<T extends { sender_id: string }>(
  candidates: T[],
  batchSize = 25,
  perSenderLimit = 5,
): T[] {
  const selected: T[] = [];
  const senderCounts = new Map<string, number>();
  for (const candidate of candidates) {
    const senderCount = senderCounts.get(candidate.sender_id) || 0;
    if (senderCount >= perSenderLimit) continue;
    selected.push(candidate);
    senderCounts.set(candidate.sender_id, senderCount + 1);
    if (selected.length >= batchSize) break;
  }
  return selected;
}
