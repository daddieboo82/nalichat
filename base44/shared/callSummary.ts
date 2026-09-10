export const CALL_SUMMARY_ENTITLEMENT = 'calls.summary';
export const CALL_SUMMARY_CONSENT_TTL_MS = 2 * 60 * 1000;
export const CALL_SUMMARY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const CALL_SUMMARY_MAX_ATTEMPTS = 3;

export type ConsentState = 'requested' | 'accepted' | 'declined' | 'revoked' | 'expired' | 'call_ended';

export interface ConsentRecord {
  participant_id: string;
  state: ConsentState;
}

export interface CaptureDecision {
  allowed: boolean;
  state: 'recording' | 'pending' | 'paused' | 'declined' | 'revoked' | 'expired' | 'participant_changed';
}

export function canonicalParticipantIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    .sort();
}

export function isParticipant(participantIds: unknown, userId: string): boolean {
  return canonicalParticipantIds(participantIds).includes(userId);
}

export function participantSetMatches(left: unknown, right: unknown): boolean {
  const a = canonicalParticipantIds(left);
  const b = canonicalParticipantIds(right);
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function evaluateCaptureAuthorization({
  participantIds,
  currentParticipantIds,
  consents,
  consentDeadline,
  sessionStatus,
  now = new Date(),
}: {
  participantIds: unknown;
  currentParticipantIds: unknown;
  consents: ConsentRecord[];
  consentDeadline: string;
  sessionStatus: string;
  now?: string | Date;
}): CaptureDecision {
  if (!participantSetMatches(participantIds, currentParticipantIds)) {
    return { allowed: false, state: 'participant_changed' };
  }
  if (sessionStatus === 'ended' || sessionStatus === 'call_failed' || sessionStatus === 'deleted') {
    return { allowed: false, state: 'expired' };
  }
  if (sessionStatus === 'paused') {
    return { allowed: false, state: 'paused' };
  }

  const states = new Map(consents.map((consent) => [consent.participant_id, consent.state]));
  const expected = canonicalParticipantIds(participantIds);
  if (expected.some((id) => states.get(id) === 'declined')) {
    return { allowed: false, state: 'declined' };
  }
  if (expected.some((id) => states.get(id) === 'revoked')) {
    return { allowed: false, state: 'revoked' };
  }
  const allAccepted = expected.every((id) => states.get(id) === 'accepted');
  if (allAccepted && sessionStatus === 'recording') {
    return { allowed: true, state: 'recording' };
  }
  const at = now instanceof Date ? now.getTime() : Date.parse(now);
  const deadline = Date.parse(consentDeadline);
  if (!Number.isFinite(at) || !Number.isFinite(deadline) || at >= deadline) {
    return { allowed: false, state: 'expired' };
  }
  if (allAccepted) return { allowed: true, state: 'recording' };
  return { allowed: false, state: 'pending' };
}

export function summaryAvailable(summary: {
  status?: string;
  participant_ids?: unknown;
  available_until?: string;
}, userId: string, now: string | Date = new Date()): boolean {
  if (summary.status !== 'completed' || !isParticipant(summary.participant_ids, userId)) return false;
  const at = now instanceof Date ? now.getTime() : Date.parse(now);
  const availableUntil = Date.parse(summary.available_until || '');
  return Number.isFinite(at) && Number.isFinite(availableUntil) && at < availableUntil;
}

export function retentionDeadline(now: string | Date = new Date()): string {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid retention clock');
  return new Date(date.getTime() + CALL_SUMMARY_RETENTION_MS).toISOString();
}

export function sanitizeActionItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => item.slice(0, 500));
}

export function isAllowedCaptureUrl(value: string, allowedHosts: string[]): boolean {
  try {
    const url = new URL(value);
    const hosts = new Set(allowedHosts.map((host) => host.trim().toLowerCase()).filter(Boolean));
    return url.protocol === 'https:' && hosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function summaryRequestDisposition({
  summary,
  requestKey,
  now = new Date(),
}: {
  summary: {
    status?: string;
    request_key?: string;
    attempts?: number;
    processing_started_at?: string;
  } | null;
  requestKey: string;
  now?: string | Date;
}): 'new' | 'duplicate' | 'completed' | 'in_progress' | 'retry' | 'retry_limit' {
  if (!summary) return 'new';
  if (summary.request_key === requestKey) return 'duplicate';
  if (summary.status === 'completed') return 'completed';
  const attempts = Number(summary.attempts || 0);
  if (attempts >= CALL_SUMMARY_MAX_ATTEMPTS) return 'retry_limit';
  const at = now instanceof Date ? now.getTime() : Date.parse(now);
  const started = Date.parse(summary.processing_started_at || '');
  if (
    summary.status === 'pending'
    && Number.isFinite(at)
    && Number.isFinite(started)
    && at - started < 15 * 60 * 1000
  ) {
    return 'in_progress';
  }
  return 'retry';
}
