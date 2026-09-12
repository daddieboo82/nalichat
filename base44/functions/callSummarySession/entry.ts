import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { isConversationId } from '../../shared/conversationIds.ts';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';
import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import {
  AiQuotaError,
  aiQuotaErrorResponse,
  executeMeteredAiRequest,
} from '../../shared/aiQuota.ts';
import {
  CALL_SUMMARY_CONSENT_TTL_MS,
  CALL_SUMMARY_ENTITLEMENT,
  CALL_SUMMARY_MAX_ATTEMPTS,
  canonicalParticipantIds,
  evaluateCaptureAuthorization,
  isAllowedCaptureUrl,
  isParticipant,
  participantSetMatches,
  retentionDeadline,
  sanitizeActionItems,
  summaryAvailable,
  summaryRequestDisposition,
} from '../../shared/callSummary.ts';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';
import { TRUSTED_MEDIA_HOSTS } from '../../shared/mediaSecurity.ts';
import {
  acquireCallSummaryStartLock,
  releaseCallSummaryStartLock,
} from '../../shared/callSummaryStartLock.ts';

const REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const MAX_CAPTURE_BYTES = 200 * 1024 * 1024;
const PROVIDER_TIMEOUT_MS = 60 * 1000;
const CAPTURE_UPLOAD_GRACE_MS = 10 * 60 * 1000;
const CAPTURE_CLOCK_TOLERANCE_MS = 5000;

function jsonError(status: number, code: string, error: string) {
  return Response.json({ error, code }, { status });
}

function errorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'NO_SPEECH') return 'NO_SPEECH';
  if (message.includes('timeout') || message.includes('timed out')) return 'PROVIDER_TIMEOUT';
  return 'PROVIDER_ERROR';
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? value as Record<string, unknown>
    : null;
}

function transcriptionText(value: unknown): string {
  if (typeof value === 'string') return value;
  const record = recordValue(value);
  if (typeof record?.text === 'string') return record.text;
  if (typeof record?.data === 'string') return record.data;
  return '';
}

async function withProviderTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: number | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Provider timed out')), PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

async function storedCaptureSize(url: string): Promise<number | null> {
  try {
    const head = await fetch(url, { method: 'HEAD', redirect: 'manual' });
    if (head.ok) {
      const length = Number(head.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0) return length;
    }
  } catch {}

  try {
    const probe = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      redirect: 'manual',
    });
    if (probe.ok || probe.status === 206) {
      const range = probe.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      if (match) return Number(match[1]);
      const length = Number(probe.headers.get('content-length'));
      if (Number.isFinite(length) && length >= 0 && probe.status !== 206) return length;
    }
    try { await probe.body?.cancel(); } catch {}
  } catch {}
  return null;
}

async function loadSession(entities: any, sessionId: unknown, callId: unknown) {
  if (typeof sessionId === 'string' && sessionId) {
    if (!isBase44EntityId(sessionId.trim())) return null;
    return entities.CallSummarySession.get(sessionId.trim());
  }
  if (typeof callId === 'string' && callId) {
    const normalizedCallId = callId.trim();
    if (normalizedCallId.length < 8 || normalizedCallId.length > 160) return null;
    const matches = await entities.CallSummarySession.filter({ call_id: normalizedCallId }, '-created_date', 1);
    return matches[0] || null;
  }
  return null;
}

async function loadConversation(entities: any, conversationId: string) {
  try {
    return await entities.Conversation.get(conversationId);
  } catch {
    return null;
  }
}

async function loadConsents(entities: any, sessionId: string) {
  return entities.CallSummaryConsent.filter({ session_id: sessionId }, 'requested_at', 20);
}

async function ensureSessionConsents(
  entities: any,
  session: any,
  participantIds: string[],
  ownerId: string,
  requestedAt: string,
) {
  const existing = await loadConsents(entities, session.id);
  const byParticipant = new Set(existing.map((consent: any) => consent.participant_id));

  for (const participantId of participantIds) {
    if (byParticipant.has(participantId)) continue;
    await entities.CallSummaryConsent.create({
      session_id: session.id,
      participant_id: participantId,
      state: participantId === ownerId ? 'accepted' : 'requested',
      requested_at: requestedAt,
      responded_at: participantId === ownerId ? requestedAt : undefined,
    });
  }
}

async function loadCaptures(entities: any, sessionId: string) {
  return entities.CallSummaryCapture.filter({ session_id: sessionId }, 'capture_started_at', 20);
}

async function loadSummary(entities: any, sessionId: string) {
  const summaries = await entities.CallSummary.filter({ session_id: sessionId }, '-created_date', 1);
  return summaries[0] || null;
}

async function expireConsents(entities: any, consents: any[], now: string) {
  await Promise.all(consents
    .filter((consent) => consent.state === 'requested' || consent.state === 'accepted')
    .map((consent) => entities.CallSummaryConsent.update(consent.id, {
      state: 'expired',
      expired_at: now,
    })));
}

async function concludeConsents(entities: any, consents: any[], now: string) {
  await Promise.all(consents.map((consent) => {
    if (consent.state === 'accepted') {
      return entities.CallSummaryConsent.update(consent.id, {
        state: 'call_ended',
        expired_at: now,
      });
    }
    if (consent.state === 'requested') {
      return entities.CallSummaryConsent.update(consent.id, {
        state: 'expired',
        expired_at: now,
      });
    }
    return Promise.resolve();
  }));
}

async function patchSession(entities: any, session: any, patch: Record<string, unknown>) {
  await entities.CallSummarySession.update(session.id, patch);
  return { ...session, ...patch };
}

async function authorizeSession(entities: any, session: any, userId: string) {
  if (!session || session.status === 'deleted' || !isParticipant(session.participant_ids, userId)) {
    return { error: jsonError(404, 'CALL_SUMMARY_NOT_FOUND', 'Call summary session not found.') };
  }
  if (!isBase44EntityId(session.conversation_id)) {
    return { error: jsonError(410, 'CALL_DELETED', 'The call conversation is no longer available.') };
  }
  const conversation = await loadConversation(entities, session.conversation_id);
  if (!conversation) {
    return { error: jsonError(410, 'CALL_DELETED', 'The call conversation is no longer available.') };
  }
  return { conversation };
}

async function enforceLiveParticipants(entities: any, session: any, conversation: any, consents: any[]) {
  if (participantSetMatches(session.participant_ids, conversation.participant_ids)) return session;
  const now = new Date().toISOString();
  await expireConsents(entities, consents, now);
  return patchSession(entities, session, {
    status: 'paused',
    failure_code: 'PARTICIPANTS_CHANGED',
    ended_at: now,
  });
}

async function snapshot(entities: any, session: any, userId: string) {
  const [consents, captures, summary] = await Promise.all([
    loadConsents(entities, session.id),
    loadCaptures(entities, session.id),
    loadSummary(entities, session.id),
  ]);
  let visibleSummary = summary;
  if (summary?.status === 'completed' && !summaryAvailable(summary, userId)) {
    await entities.CallSummary.update(summary.id, {
      status: 'deleted',
      transcript: '',
      summary: '',
      action_items: [],
      deleted_at: new Date().toISOString(),
    });
    visibleSummary = { ...summary, status: 'deleted', transcript: '', summary: '', action_items: [] };
  }
  return {
    session: {
      id: session.id,
      call_id: session.call_id,
      conversation_id: session.conversation_id,
      owner_id: session.owner_id,
      participant_ids: session.participant_ids,
      status: session.status,
      consent_deadline: session.consent_deadline,
      capture_started_at: session.capture_started_at || null,
      ended_at: session.ended_at || null,
      capture_deadline: session.capture_deadline || null,
      failure_code: session.failure_code || null,
    },
    consents: consents.map((consent: any) => ({
      participant_id: consent.participant_id,
      state: consent.state,
      requested_at: consent.requested_at,
      responded_at: consent.responded_at || null,
      revoked_at: consent.revoked_at || null,
      expired_at: consent.expired_at || null,
    })),
    capture_participant_ids: captures
      .filter((capture: any) => capture.status === 'ready' || capture.status === 'processed')
      .map((capture: any) => capture.participant_id),
    capture_allowed: session.status === 'recording',
    summary: visibleSummary ? {
      status: visibleSummary.status,
      summary: visibleSummary.status === 'completed' ? visibleSummary.summary : '',
      action_items: visibleSummary.status === 'completed' ? visibleSummary.action_items || [] : [],
      transcript: visibleSummary.status === 'completed' ? visibleSummary.transcript : '',
      error_code: visibleSummary.error_code || null,
      attempts: visibleSummary.attempts || 0,
      available_until: visibleSummary.available_until || null,
    } : null,
  };
}

async function createSession(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  if (typeof body.call_id !== 'string' || body.call_id.length < 8 || body.call_id.length > 160) {
    return jsonError(400, 'INVALID_CALL_ID', 'A valid call_id is required.');
  }
  if (
    typeof body.conversation_id !== 'string'
    || !isConversationId(body.conversation_id.trim())
  ) {
    return jsonError(400, 'INVALID_CONVERSATION', 'A valid conversation_id is required.');
  }
  if (body.accept_terms !== true) {
    return jsonError(400, 'EXPLICIT_CONSENT_REQUIRED', 'You must explicitly accept before requesting consent.');
  }

  const conversation = await loadConversation(entities, body.conversation_id);
  const participantIds = canonicalParticipantIds(conversation?.participant_ids);
  if (!conversation || conversation.type !== 'dm' || participantIds.length !== 2 || !participantIds.includes(user.id)) {
    return jsonError(403, 'CALL_PARTICIPANT_REQUIRED', 'Only participants in a 1:1 call can request a summary.');
  }

  const access = await resolveUserSubscription(entities.Subscription, user.id);
  if (access.entitlements[CALL_SUMMARY_ENTITLEMENT] !== true) {
    return jsonError(403, 'CALL_SUMMARY_UPGRADE_REQUIRED', 'Premium Plus is required for call summaries.');
  }

  const startLockId = await acquireCallSummaryStartLock(entities, body.call_id);
  if (!startLockId) {
    return jsonError(
      409,
      'CALL_SUMMARY_START_IN_PROGRESS',
      'Call summary setup is already in progress. Please retry.',
    );
  }

  try {
    const existing = await entities.CallSummarySession.filter({ call_id: body.call_id }, '-created_date', 1);
    if (existing[0] && existing[0].status !== 'deleted') {
      if (!isParticipant(existing[0].participant_ids, user.id)) {
        return jsonError(404, 'CALL_SUMMARY_NOT_FOUND', 'Call summary session not found.');
      }
      const requestedAt = existing[0].created_date || new Date().toISOString();
      await ensureSessionConsents(
        entities,
        existing[0],
        canonicalParticipantIds(existing[0].participant_ids),
        existing[0].owner_id,
        requestedAt,
      );
      return Response.json(await snapshot(entities, existing[0], user.id));
    }

    const now = new Date();
    const requestedAt = now.toISOString();
    const session = await entities.CallSummarySession.create({
      call_id: body.call_id,
      conversation_id: conversation.id,
      owner_id: user.id,
      participant_ids: participantIds,
      status: 'consent_pending',
      consent_deadline: new Date(now.getTime() + CALL_SUMMARY_CONSENT_TTL_MS).toISOString(),
      failure_code: '',
    });
    await ensureSessionConsents(
      entities,
      session,
      participantIds,
      user.id,
      requestedAt,
    );
    return Response.json(await snapshot(entities, session, user.id));
  } finally {
    await releaseCallSummaryStartLock(entities, startLockId);
  }
}

async function readSession(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  let session = await loadSession(entities, body.session_id, body.call_id);
  if (!session) return jsonError(404, 'CALL_SUMMARY_NOT_FOUND', 'Call summary session not found.');
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  const consents = await loadConsents(entities, session.id);
  session = await enforceLiveParticipants(entities, session, authorized.conversation, consents);
  if (
    session.status === 'ended'
    && session.capture_deadline
    && Date.now() >= Date.parse(session.capture_deadline)
  ) {
    const captures = await loadCaptures(entities, session.id);
    const readyParticipants = new Set(captures
      .filter((capture: any) => capture.status === 'ready' && capture.audio_url)
      .map((capture: any) => capture.participant_id));
    if (canonicalParticipantIds(session.participant_ids).some((id) => !readyParticipants.has(id))) {
      const now = new Date().toISOString();
      await Promise.all(captures.map((capture: any) => entities.CallSummaryCapture.update(capture.id, {
        status: 'deleted',
        audio_url: '',
        deleted_at: now,
      })));
      session = await patchSession(entities, session, {
        status: 'call_failed',
        failure_code: 'CAPTURES_INCOMPLETE',
      });
    }
  }

  const decision = evaluateCaptureAuthorization({
    participantIds: session.participant_ids,
    currentParticipantIds: authorized.conversation.participant_ids,
    consents,
    consentDeadline: session.consent_deadline,
    sessionStatus: session.status,
  });
  if (decision.state === 'expired' && session.status === 'consent_pending') {
    const now = new Date().toISOString();
    await expireConsents(entities, consents, now);
    session = await patchSession(entities, session, {
      status: 'paused',
      failure_code: 'CONSENT_EXPIRED',
      ended_at: now,
    });
  } else if (decision.allowed && session.status === 'consent_pending') {
    session = await patchSession(entities, session, {
      status: 'recording',
      capture_started_at: new Date().toISOString(),
      failure_code: '',
    });
  }
  return Response.json(await snapshot(entities, session, user.id));
}

async function readLatestSession(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  if (
    typeof body.conversation_id !== 'string'
    || !isConversationId(body.conversation_id.trim())
  ) {
    return jsonError(400, 'INVALID_CONVERSATION', 'A valid conversation_id is required.');
  }
  const conversation = await loadConversation(entities, body.conversation_id);
  if (!conversation || !isParticipant(conversation.participant_ids, user.id)) {
    return jsonError(404, 'CALL_SUMMARY_NOT_FOUND', 'Call summary session not found.');
  }
  const sessions = await entities.CallSummarySession.filter(
    { conversation_id: body.conversation_id },
    '-created_date',
    20,
  );
  const session = sessions.find((candidate: any) => (
    candidate.status !== 'deleted' && isParticipant(candidate.participant_ids, user.id)
  ));
  if (!session) return jsonError(404, 'CALL_SUMMARY_NOT_FOUND', 'Call summary session not found.');
  return readSession(base44, user, { session_id: session.id });
}

async function respondToConsent(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  let session = await loadSession(entities, body.session_id, null);
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  let consents = await loadConsents(entities, session.id);
  session = await enforceLiveParticipants(entities, session, authorized.conversation, consents);
  if (session.status === 'ended' || session.status === 'call_failed' || session.status === 'deleted') {
    return jsonError(409, 'CALL_ALREADY_ENDED', 'Consent can no longer be changed for this call.');
  }
  const consent = consents.find((item: any) => item.participant_id === user.id);
  if (!consent) return jsonError(403, 'CALL_PARTICIPANT_REQUIRED', 'Participant consent record not found.');
  const now = new Date().toISOString();

  if (body.decision === 'revoke') {
    await entities.CallSummaryConsent.update(consent.id, {
      state: 'revoked',
      revoked_at: now,
    });
    session = await patchSession(entities, session, {
      status: 'paused',
      failure_code: 'CONSENT_REVOKED',
    });
  } else if (body.decision === 'decline') {
    await entities.CallSummaryConsent.update(consent.id, {
      state: 'declined',
      responded_at: now,
    });
    session = await patchSession(entities, session, {
      status: 'paused',
      failure_code: 'CONSENT_DECLINED',
    });
  } else if (body.decision === 'accept') {
    if (consent.state === 'declined' || consent.state === 'revoked' || consent.state === 'expired') {
      return jsonError(409, 'CONSENT_FINAL', 'This consent decision is final for the current call.');
    }
    if (Date.parse(session.consent_deadline) <= Date.now()) {
      await expireConsents(entities, consents, now);
      session = await patchSession(entities, session, {
        status: 'paused',
        failure_code: 'CONSENT_EXPIRED',
      });
    } else {
      await entities.CallSummaryConsent.update(consent.id, {
        state: 'accepted',
        responded_at: now,
      });
      consents = await loadConsents(entities, session.id);
      const decision = evaluateCaptureAuthorization({
        participantIds: session.participant_ids,
        currentParticipantIds: authorized.conversation.participant_ids,
        consents,
        consentDeadline: session.consent_deadline,
        sessionStatus: session.status,
      });
      if (decision.allowed) {
        session = await patchSession(entities, session, {
          status: 'recording',
          capture_started_at: now,
          failure_code: '',
        });
      }
    }
  } else {
    return jsonError(400, 'INVALID_CONSENT_DECISION', 'Decision must be accept, decline, or revoke.');
  }
  return Response.json(await snapshot(entities, session, user.id));
}

async function finishSession(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  let session = await loadSession(entities, body.session_id, body.call_id);
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  if (session.status !== 'ended' && session.status !== 'call_failed') {
    const now = new Date().toISOString();
    const consents = await loadConsents(entities, session.id);
    await concludeConsents(entities, consents, now);
    const failed = body.reason === 'call_failed';
    session = await patchSession(entities, session, {
      status: failed ? 'call_failed' : 'ended',
      ended_at: now,
      capture_deadline: new Date(Date.parse(now) + CAPTURE_UPLOAD_GRACE_MS).toISOString(),
      failure_code: failed ? 'CALL_FAILED' : session.failure_code || '',
    });
  }
  return Response.json(await snapshot(entities, session, user.id));
}

async function pauseSession(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  let session = await loadSession(entities, body.session_id, null);
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  if (session.status === 'recording' || session.status === 'consent_pending') {
    session = await patchSession(entities, session, {
      status: 'paused',
      failure_code: body.reason === 'capture_unavailable'
        ? 'CAPTURE_UNAVAILABLE'
        : 'CAPTURE_FAILED',
    });
  }
  return Response.json(await snapshot(entities, session, user.id));
}

async function registerCapture(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  const session = await loadSession(entities, body.session_id, null);
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  const consents = await loadConsents(entities, session.id);
  const consent = consents.find((item: any) => item.participant_id === user.id);
  if (consent?.state !== 'accepted' && consent?.state !== 'call_ended') {
    return jsonError(403, 'CAPTURE_NOT_CONSENTED', 'Accepted consent is required for this capture.');
  }
  if (!['recording', 'paused', 'ended'].includes(session.status)) {
    return jsonError(409, 'CAPTURE_NOT_ALLOWED', 'Capture is not allowed in the current call state.');
  }
  const size = Number(body.byte_size);
  if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_CAPTURE_BYTES) {
    return jsonError(400, 'INVALID_CAPTURE_SIZE', 'Capture size is invalid.');
  }
  if (typeof body.audio_url !== 'string' || !isAllowedCaptureUrl(body.audio_url, TRUSTED_MEDIA_HOSTS)) {
    return jsonError(400, 'INVALID_CAPTURE_URL', 'Capture URL is not from an approved upload host.');
  }
  const url = new URL(body.audio_url);
  const captureStart = Date.parse(body.capture_started_at);
  const captureEnd = Date.parse(body.capture_ended_at);
  const authorizedStart = Date.parse(session.capture_started_at || '');
  if (
    !Number.isFinite(captureStart)
    || !Number.isFinite(captureEnd)
    || !Number.isFinite(authorizedStart)
    || captureEnd < captureStart
    || captureStart < authorizedStart - CAPTURE_CLOCK_TOLERANCE_MS
    || (session.ended_at && captureEnd > Date.parse(session.ended_at) + CAPTURE_CLOCK_TOLERANCE_MS)
    || (consent.revoked_at && captureEnd > Date.parse(consent.revoked_at) + CAPTURE_CLOCK_TOLERANCE_MS)
  ) {
    return jsonError(400, 'INVALID_CAPTURE_WINDOW', 'Capture timestamps are outside the consented window.');
  }

  const existing = await entities.CallSummaryCapture.filter({
    session_id: session.id,
    participant_id: user.id,
  }, '-created_date', 1);
  const payload = {
    audio_url: url.toString(),
    mime_type: typeof body.mime_type === 'string' ? body.mime_type.slice(0, 100) : 'audio/webm',
    byte_size: size,
    capture_started_at: new Date(captureStart).toISOString(),
    capture_ended_at: new Date(captureEnd).toISOString(),
    status: 'ready',
  };
  if (existing[0]) {
    await entities.CallSummaryCapture.update(existing[0].id, payload);
  } else {
    await entities.CallSummaryCapture.create({
      session_id: session.id,
      participant_id: user.id,
      ...payload,
    });
  }
  return Response.json(await snapshot(entities, session, user.id));
}

async function generateSummary(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  const session = await loadSession(entities, body.session_id, null);
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  if (session.owner_id !== user.id) {
    return jsonError(403, 'SUMMARY_OWNER_REQUIRED', 'Only the participant who requested the summary can generate it.');
  }
  if (session.status !== 'ended') {
    return jsonError(409, 'CALL_NOT_ENDED', 'The call must end before summary generation.');
  }
  const access = await resolveUserSubscription(entities.Subscription, user.id);
  if (access.entitlements[CALL_SUMMARY_ENTITLEMENT] !== true) {
    return jsonError(403, 'CALL_SUMMARY_UPGRADE_REQUIRED', 'Premium Plus is required to generate a call summary.');
  }
  const requestKey = typeof body.request_key === 'string' ? body.request_key : '';
  if (!REQUEST_KEY_PATTERN.test(requestKey)) {
    return jsonError(400, 'INVALID_REQUEST_KEY', 'A valid request_key is required.');
  }

  const captures = (await loadCaptures(entities, session.id))
    .filter((capture: any) => capture.status === 'ready' && capture.audio_url);
  const consents = await loadConsents(entities, session.id);
  const consentByParticipant = new Map(consents.map((consent: any) => [
    consent.participant_id,
    consent.state,
  ]));
  if (canonicalParticipantIds(session.participant_ids).some((participantId) => (
    consentByParticipant.get(participantId) !== 'call_ended'
  ))) {
    return jsonError(409, 'CONSENT_INCOMPLETE', 'Every participant must have accepted for the full capture window.');
  }
  if (captures.length !== canonicalParticipantIds(session.participant_ids).length) {
    return jsonError(409, 'CAPTURES_INCOMPLETE', 'Each consenting participant must upload their local capture before generation.');
  }

  let summary = await loadSummary(entities, session.id);
  const disposition = summaryRequestDisposition({ summary, requestKey });
  if (disposition === 'duplicate' || disposition === 'completed') {
    return Response.json(await snapshot(entities, session, user.id));
  }
  if (disposition === 'in_progress') {
    return jsonError(409, 'SUMMARY_IN_PROGRESS', 'Summary generation is already in progress.');
  }
  if (disposition === 'retry_limit') {
    return jsonError(409, 'SUMMARY_RETRY_LIMIT', 'Summary generation retry limit reached.');
  }
  const attempts = Number(summary?.attempts || 0);
  let generationCompleted = false;

  try {
    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'call_summary',
      requestKey,
      dispatch: async () => {
        const pendingData = {
          participant_ids: session.participant_ids,
          requested_by: user.id,
          request_key: requestKey,
          status: 'pending',
          transcript: '',
          summary: '',
          action_items: [],
          error_code: '',
          attempts: attempts + 1,
          processing_started_at: new Date().toISOString(),
        };
        if (summary) {
          await entities.CallSummary.update(summary.id, pendingData);
          summary = { ...summary, ...pendingData };
        } else {
          summary = await entities.CallSummary.create({ session_id: session.id, ...pendingData });
        }
        const transcriptParts: string[] = [];
        const orderedCaptures = canonicalParticipantIds(session.participant_ids)
          .map((participantId) => captures.find((capture: any) => capture.participant_id === participantId));
        for (let index = 0; index < orderedCaptures.length; index += 1) {
          const capture = orderedCaptures[index];
          const actualSize = await storedCaptureSize(capture.audio_url);
          if (actualSize === null) {
            throw new Error('CAPTURE_SIZE_UNVERIFIED');
          }
          if (actualSize <= 0 || actualSize > MAX_CAPTURE_BYTES) {
            throw new Error('CAPTURE_TOO_LARGE');
          }
          const transcriptResult = await withProviderTimeout<unknown>(
            base44.asServiceRole.integrations.Core.TranscribeAudio({
              audio_url: capture.audio_url,
            }),
          );
          const text = transcriptionText(transcriptResult);
          if (text.trim()) {
            transcriptParts.push(`Participant ${index + 1}: ${text.trim()}`);
          }
        }
        if (transcriptParts.length === 0) throw new Error('NO_SPEECH');
        const transcript = transcriptParts.join('\n\n');
        const generated = await withProviderTimeout<unknown>(base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Summarize this consented 1:1 call transcript concisely. Do not invent facts, names, owners, or deadlines. Return a short summary and only explicit action items. If there are no action items, return an empty array.\n\nTranscript:\n${transcript}`,
          response_json_schema: {
            type: 'object',
            properties: {
              summary: { type: 'string' },
              action_items: { type: 'array', items: { type: 'string' } },
            },
            required: ['summary', 'action_items'],
          },
        }));
        const generatedRecord = recordValue(generated);
        const summaryText = typeof generatedRecord?.summary === 'string'
          ? generatedRecord.summary.trim()
          : '';
        if (!summaryText) throw new Error('Provider returned an empty summary');
        return {
          transcript,
          summary: summaryText.slice(0, 10000),
          action_items: sanitizeActionItems(generatedRecord?.action_items),
        };
      },
    });

    await entities.CallSummary.update(summary.id, {
      status: 'completed',
      transcript: result.transcript,
      summary: result.summary,
      action_items: result.action_items,
      error_code: '',
      completed_at: new Date().toISOString(),
      available_until: retentionDeadline(),
    });
    generationCompleted = true;
    try {
      await Promise.all(captures.map((capture: any) => entities.CallSummaryCapture.update(capture.id, {
        status: 'processed',
        audio_url: '',
        deleted_at: new Date().toISOString(),
      })));
    } catch (cleanupError) {
      console.error('call summary capture cleanup failed:', cleanupError);
    }
    try {
      await entities.Notification.bulkCreate(canonicalParticipantIds(session.participant_ids).map((participantId) => ({
        recipient_id: participantId,
        type: 'message',
        actor_id: user.id,
        actor_name: user.display_name || user.full_name || 'A call participant',
        message: 'Your call summary is ready.',
        link: '/messages',
        read: false,
      })));
    } catch (notificationError) {
      console.error('call summary notification failed:', notificationError);
    }
    return Response.json({ ...(await snapshot(entities, session, user.id)), quota });
  } catch (error) {
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    if (!generationCompleted && summary?.id) {
      await entities.CallSummary.update(summary.id, {
        status: 'failed',
        transcript: '',
        summary: '',
        action_items: [],
        error_code: errorCode(error),
      });
    }
    console.error('call summary generation failed:', error);
    return jsonError(502, errorCode(error), 'Summary generation failed.');
  }
}

async function deleteSummary(base44: any, user: any, body: any) {
  const entities = base44.asServiceRole.entities;
  let session = await loadSession(entities, body.session_id, null);
  const authorized = await authorizeSession(entities, session, user.id);
  if (authorized.error) return authorized.error;
  const [consents, captures, summary] = await Promise.all([
    loadConsents(entities, session.id),
    loadCaptures(entities, session.id),
    loadSummary(entities, session.id),
  ]);
  const now = new Date().toISOString();
  await Promise.all([
    ...consents.map((consent: any) => entities.CallSummaryConsent.update(consent.id, {
      state: 'expired',
      expired_at: now,
    })),
    ...captures.map((capture: any) => entities.CallSummaryCapture.update(capture.id, {
      status: 'deleted',
      audio_url: '',
      deleted_at: now,
    })),
    ...(summary ? [entities.CallSummary.update(summary.id, {
      status: 'deleted',
      transcript: '',
      summary: '',
      action_items: [],
      deleted_at: now,
    })] : []),
  ]);
  session = await patchSession(entities, session, {
    status: 'deleted',
    deleted_at: now,
  });
  return Response.json({ deleted: true, session_id: session.id });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return jsonError(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonError(401, 'UNAUTHORIZED', 'Unauthorized');
    const body = await readJsonBodyLimited(req, 64 * 1024);

    const requestRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'call_summary_request',
      600,
    );
    if (!requestRate.allowed) {
      return jsonError(429, 'RATE_LIMITED', 'Call summary request rate limit exceeded. Please try again later.');
    }

    const moderatedAction = ['start', 'register_capture', 'generate'].includes(body?.action);
    if (moderatedAction && user.is_banned) {
      return jsonError(403, 'BANNED', 'This action is unavailable while the account is banned.');
    }
    if (
      moderatedAction
      && user.timeout_until
      && new Date(user.timeout_until).getTime() > Date.now()
    ) {
      return jsonError(403, 'TIMED_OUT', 'This action is unavailable during a timeout.');
    }

    switch (body?.action) {
      case 'start':
        return createSession(base44, user, body);
      case 'get':
        return readSession(base44, user, body);
      case 'list':
        return readLatestSession(base44, user, body);
      case 'consent':
        return respondToConsent(base44, user, body);
      case 'end':
        return finishSession(base44, user, body);
      case 'pause':
        return pauseSession(base44, user, body);
      case 'register_capture':
        return registerCapture(base44, user, body);
      case 'generate':
        return generateSummary(base44, user, body);
      case 'delete':
        return deleteSummary(base44, user, body);
      default:
        return jsonError(400, 'INVALID_ACTION', 'Unknown call summary action.');
    }
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    if (error instanceof AiQuotaError) return aiQuotaErrorResponse(error);
    console.error('callSummarySession error:', error);
    return jsonError(500, 'CALL_SUMMARY_ERROR', 'Call summary request failed.');
  }
});
