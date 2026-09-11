export const LOCKED_CHAT_KDF = 'PBKDF2-SHA-256';
export const LOCKED_CHAT_PBKDF2_ITERATIONS = 600_000;
export const LOCKED_CHAT_RESET_TTL_MS = 10 * 60 * 1000;
export const LOCKED_CHAT_MAX_RESET_ATTEMPTS = 5;
export const LOCKED_CHAT_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export interface AttemptState {
  failedAttempts: number;
  lockedUntil: string | null;
  retryAfterMs: number;
}

export function isConversationMember(
  conversation: { participant_ids?: unknown } | null | undefined,
  userId: string,
): boolean {
  return Array.isArray(conversation?.participant_ids)
    && conversation.participant_ids.includes(userId);
}

export function canConfigureLockedConversation(
  conversation: { participant_ids?: unknown } | null | undefined,
  userId: string,
  entitled: boolean,
): boolean {
  return entitled && isConversationMember(conversation, userId);
}

export function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function failedPinAttempt(
  previousFailures: number,
  nowMs = Date.now(),
): AttemptState {
  const failedAttempts = Math.max(0, previousFailures) + 1;
  if (failedAttempts < 5) {
    return { failedAttempts, lockedUntil: null, retryAfterMs: 0 };
  }
  const retryAfterMs = Math.min(15 * 60 * 1000, 30_000 * (2 ** (failedAttempts - 5)));
  return {
    failedAttempts,
    lockedUntil: new Date(nowMs + retryAfterMs).toISOString(),
    retryAfterMs,
  };
}

export function remainingLockoutMs(lockedUntil: unknown, nowMs = Date.now()): number {
  if (typeof lockedUntil !== 'string') return 0;
  const deadline = Date.parse(lockedUntil);
  return Number.isFinite(deadline) ? Math.max(0, deadline - nowMs) : 0;
}

export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as {
    status?: unknown;
    response?: { status?: unknown };
    message?: unknown;
  };
  return candidate.status === 404
    || candidate.response?.status === 404
    || (typeof candidate.message === 'string' && /\bnot found\b/i.test(candidate.message));
}

export function isResetChallengeUsable(
  challenge: {
    consumed_at?: unknown;
    expires_at?: unknown;
    attempt_count?: unknown;
  } | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!challenge || challenge.consumed_at) return false;
  const expiresAt = typeof challenge.expires_at === 'string'
    ? Date.parse(challenge.expires_at)
    : Number.NaN;
  return Number.isFinite(expiresAt)
    && expiresAt > nowMs
    && Number(challenge.attempt_count) < LOCKED_CHAT_MAX_RESET_ATTEMPTS;
}

export function countActiveVerificationAttempts(
  attempts: Array<{
    attempted_at?: unknown;
    status?: unknown;
  }>,
  nowMs = Date.now(),
): number {
  return attempts.filter((attempt) => {
    if (attempt.status !== 'pending') return false;
    const attemptedAt = typeof attempt.attempted_at === 'string'
      ? Date.parse(attempt.attempted_at)
      : Number.NaN;
    return Number.isFinite(attemptedAt)
      && attemptedAt > nowMs - LOCKED_CHAT_ATTEMPT_WINDOW_MS;
  }).length;
}

export function validPinConfiguration(value: {
  salt?: unknown;
  verifier?: unknown;
  iterations?: unknown;
}): boolean {
  if (value.iterations !== LOCKED_CHAT_PBKDF2_ITERATIONS) return false;
  if (typeof value.salt !== 'string' || typeof value.verifier !== 'string') return false;
  try {
    return atob(value.salt).length === 16 && atob(value.verifier).length === 32;
  } catch {
    return false;
  }
}

export async function hashResetCode(userId: string, code: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${userId}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function lockedNotification(conversationId: string) {
  return {
    conversation_id: conversationId,
    locked_chat: true,
    actor_id: '',
    actor_name: 'Locked chat',
    actor_avatar: '',
    message: 'New message in a locked chat.',
    link: `/messages?id=${encodeURIComponent(conversationId)}`,
  };
}
