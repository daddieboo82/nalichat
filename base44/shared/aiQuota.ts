import { resolveUserSubscription } from './subscriptionAccess.ts';

export const AI_QUOTA_EXHAUSTED = 'AI_DAILY_QUOTA_EXHAUSTED';
export const AI_REQUEST_ALREADY_DISPATCHED = 'AI_REQUEST_ALREADY_DISPATCHED';
const PAGE_SIZE = 500;
const RESERVATION_TTL_MS = 15 * 60 * 1000;
const REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

interface UsageRecord {
  id: string;
  user_id: string;
  utc_day: string;
  request_key: string;
  operation: string;
  status: 'reserved' | 'dispatched';
  reserved_at: string;
  dispatched_at?: string | null;
}
interface UsageEntity {
  filter(
    query: Record<string, unknown>,
    sort?: string,
    limit?: number,
    skip?: number,
  ): Promise<UsageRecord[]>;
  create(data: Omit<UsageRecord, 'id'> & { id?: string }): Promise<UsageRecord>;
  get(id: string): Promise<UsageRecord | null>;
  update(id: string, data: Partial<UsageRecord>): Promise<UsageRecord>;
  delete(id: string): Promise<unknown>;
}

export interface AiQuotaSnapshot {
  limit: number;
  used: number;
  remaining: number;
  reset_at: string;
}

export class AiQuotaError extends Error {
  status: number;
  code: string;
  quota: AiQuotaSnapshot;

  constructor(status: number, code: string, message: string, quota: AiQuotaSnapshot) {
    super(message);
    this.name = 'AiQuotaError';
    this.status = status;
    this.code = code;
    this.quota = quota;
  }
}

export function utcUsageWindow(now: string | Date = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid quota clock');
  const utcDay = date.toISOString().slice(0, 10);
  const resetAt = new Date(`${utcDay}T00:00:00.000Z`);
  resetAt.setUTCDate(resetAt.getUTCDate() + 1);
  return { utcDay, resetAt: resetAt.toISOString(), now: date };
}

function snapshot(limit: number, used: number, resetAt: string): AiQuotaSnapshot {
  return {
    limit,
    used,
    remaining: Math.max(0, limit - used),
    reset_at: resetAt,
  };
}

async function reservationId(userId: string, utcDay: string, requestKey: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${utcDay}:${requestKey}`),
  );
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `ai_usage_${hex}`;
}

async function loadUsage(entity: UsageEntity, userId: string, utcDay: string) {
  const records: UsageRecord[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await entity.filter(
      { user_id: userId, utc_day: utcDay },
      '-created_date',
      PAGE_SIZE,
      skip,
    );
    records.push(...page);
    if (page.length < PAGE_SIZE) return records;
  }
}

export async function readAiQuota(
  entity: UsageEntity,
  userId: string,
  utcDay: string,
  limit: number,
  resetAt: string,
) {
  const records = await loadUsage(entity, userId, utcDay);
  const used = records.filter((record) => record.status === 'dispatched').length;
  return snapshot(limit, used, resetAt);
}

export async function reserveAiUsage({
  entity,
  userId,
  operation,
  requestKey,
  limit,
  now = new Date(),
}: {
  entity: UsageEntity;
  userId: string;
  operation: string;
  requestKey: unknown;
  limit: number;
  now?: string | Date;
}) {
  const normalizedRequestKey = typeof requestKey === 'string' ? requestKey : '';
  if (!REQUEST_KEY_PATTERN.test(normalizedRequestKey)) {
    throw new Error('A valid request_key is required');
  }

  const window = utcUsageWindow(now);
  const records = await loadUsage(entity, userId, window.utcDay);
  const duplicate = records.find((record) => record.request_key === normalizedRequestKey);
  const dispatched = records.filter((record) => record.status === 'dispatched');
  const activeReservations = records.filter((record) => (
    record.status === 'reserved'
    && window.now.getTime() - Date.parse(record.reserved_at) < RESERVATION_TTL_MS
  ));
  const quota = snapshot(limit, dispatched.length, window.resetAt);

  if (duplicate?.status === 'dispatched') {
    throw new AiQuotaError(
      409,
      AI_REQUEST_ALREADY_DISPATCHED,
      'This AI request was already dispatched.',
      quota,
    );
  }
  if (duplicate?.status === 'reserved') {
    const isActive = window.now.getTime() - Date.parse(duplicate.reserved_at) < RESERVATION_TTL_MS;
    if (isActive) {
      throw new AiQuotaError(409, 'AI_REQUEST_IN_PROGRESS', 'This AI request is already in progress.', quota);
    }
    await entity.delete(duplicate.id);
  }

  if (dispatched.length + activeReservations.length >= limit) {
    throw new AiQuotaError(
      429,
      AI_QUOTA_EXHAUSTED,
      'Daily AI request limit reached.',
      quota,
    );
  }

  const id = await reservationId(userId, window.utcDay, normalizedRequestKey);
  let reservation: UsageRecord;
  try {
    reservation = await entity.create({
      id,
      user_id: userId,
      utc_day: window.utcDay,
      request_key: normalizedRequestKey,
      operation,
      status: 'reserved',
      reserved_at: window.now.toISOString(),
      dispatched_at: null,
    });
  } catch (createError) {
    const raced = await entity.get(id).catch(() => null);
    if (!raced) throw createError;

    const racedQuota = snapshot(limit, dispatched.length, window.resetAt);
    if (raced.status === 'dispatched') {
      throw new AiQuotaError(
        409,
        AI_REQUEST_ALREADY_DISPATCHED,
        'This AI request was already dispatched.',
        racedQuota,
      );
    }
    if (raced.status === 'reserved') {
      throw new AiQuotaError(
        409,
        'AI_REQUEST_IN_PROGRESS',
        'This AI request is already in progress.',
        racedQuota,
      );
    }
    throw createError;
  }

  return { reservation, quota };
}

export async function commitAiUsage({
  entity,
  reservation,
  limit,
  resetAt,
  now = new Date(),
}: {
  entity: UsageEntity;
  reservation: UsageRecord;
  limit: number;
  resetAt: string;
  now?: string | Date;
}) {
  const date = now instanceof Date ? now : new Date(now);
  await entity.update(reservation.id, {
    status: 'dispatched',
    dispatched_at: date.toISOString(),
  });
  const records = await loadUsage(entity, reservation.user_id, reservation.utc_day);
  const used = records.filter((record) => (
    record.status === 'dispatched' || record.id === reservation.id
  )).length;
  return snapshot(limit, used, resetAt);
}

export async function executeMeteredAiRequest<T>({
  base44,
  user,
  operation,
  requestKey,
  dispatch,
  now = new Date(),
}: {
  base44: {
    asServiceRole: {
      entities: {
        Subscription: Parameters<typeof resolveUserSubscription>[0];
        AIUsage: UsageEntity;
      };
    };
  };
  user: { id: string };
  operation: string;
  requestKey: unknown;
  dispatch: () => Promise<T>;
  now?: string | Date;
}): Promise<{ result: T; quota: AiQuotaSnapshot }> {
  const access = await resolveUserSubscription(
    base44.asServiceRole.entities.Subscription,
    user.id,
    (now instanceof Date ? now : new Date(now)).toISOString(),
  );
  const limit = access.limits.ai.requestsPerUtcDay;
  const normalizedRequestKey = REQUEST_KEY_PATTERN.test(
    typeof requestKey === 'string' ? requestKey : '',
  )
    ? requestKey
    : `${operation}:${crypto.randomUUID()}`;
  const { reservation, quota } = await reserveAiUsage({
    entity: base44.asServiceRole.entities.AIUsage,
    userId: user.id,
    operation,
    requestKey: normalizedRequestKey,
    limit,
    now,
  });

  let dispatched = false;
  let result: T;
  try {
    const pendingResult = dispatch();
    dispatched = true;
    result = await pendingResult;
  } catch (error) {
    if (dispatched) {
      await commitAiUsage({
        entity: base44.asServiceRole.entities.AIUsage,
        reservation,
        limit,
        resetAt: quota.reset_at,
        now,
      });
    } else {
      await base44.asServiceRole.entities.AIUsage.delete(reservation.id);
    }
    throw error;
  }

  try {
    const committedQuota = await commitAiUsage({
      entity: base44.asServiceRole.entities.AIUsage,
      reservation,
      limit,
      resetAt: quota.reset_at,
      now,
    });
    return { result, quota: committedQuota };
  } catch (firstCommitError) {
    try {
      const committedQuota = await commitAiUsage({
        entity: base44.asServiceRole.entities.AIUsage,
        reservation,
        limit,
        resetAt: quota.reset_at,
        now,
      });
      return { result, quota: committedQuota };
    } catch (retryError) {
      console.error('AI usage commit failed after retry:', retryError);
      throw firstCommitError;
    }
  }
}

export function aiQuotaErrorResponse(error: AiQuotaError): Response {
  return Response.json({
    error: error.message,
    code: error.code,
    quota: error.quota,
    ...error.quota,
  }, { status: error.status });
}
