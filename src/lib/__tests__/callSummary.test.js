import { describe, expect, it } from 'vitest';
import {
  CALL_SUMMARY_CONSENT_TTL_MS,
  CALL_SUMMARY_RETENTION_MS,
  canonicalParticipantIds,
  evaluateCaptureAuthorization,
  isAllowedCaptureUrl,
  isParticipant,
  participantSetMatches,
  retentionDeadline,
  summaryAvailable,
  summaryRequestDisposition,
} from '../../../base44/shared/callSummary.ts';
import { canUploadCallCapture, shouldCaptureCallSummary } from '@/lib/callSummaryCapture';
import { resolveEntitlements } from '../../../base44/shared/subscription.ts';

const participants = ['user-a', 'user-b'];
const deadline = '2026-09-10T12:02:00.000Z';

function decision(consents, overrides = {}) {
  return evaluateCaptureAuthorization({
    participantIds: participants,
    currentParticipantIds: participants,
    consents,
    consentDeadline: deadline,
    sessionStatus: 'consent_pending',
    now: '2026-09-10T12:01:00.000Z',
    ...overrides,
  });
}

describe('call summary consent and authorization', () => {
  it('canonicalizes the server participant snapshot and authorizes only participants', () => {
    expect(canonicalParticipantIds(['user-b', 'user-a', 'user-a', null])).toEqual(participants);
    expect(participantSetMatches(['user-b', 'user-a'], participants)).toBe(true);
    expect(isParticipant(participants, 'user-a')).toBe(true);
    expect(isParticipant(participants, 'outsider')).toBe(false);
  });

  it('requires explicit acceptance from every participant before capture', () => {
    expect(decision([
      { participant_id: 'user-a', state: 'accepted' },
      { participant_id: 'user-b', state: 'requested' },
    ])).toEqual({ allowed: false, state: 'pending' });

    expect(decision([
      { participant_id: 'user-a', state: 'accepted' },
      { participant_id: 'user-b', state: 'accepted' },
    ])).toEqual({ allowed: true, state: 'recording' });
  });

  it.each([
    ['declined', 'declined'],
    ['revoked', 'revoked'],
  ])('stops capture when one participant has %s', (state, expected) => {
    expect(decision([
      { participant_id: 'user-a', state: 'accepted' },
      { participant_id: 'user-b', state },
    ])).toEqual({ allowed: false, state: expected });
  });

  it('keeps a server-paused session stopped even while prior consents remain accepted', () => {
    expect(decision([
      { participant_id: 'user-a', state: 'accepted' },
      { participant_id: 'user-b', state: 'accepted' },
    ], { sessionStatus: 'paused' })).toEqual({ allowed: false, state: 'paused' });
  });

  it('expires consent at the deadline and invalidates it on participant join or leave', () => {
    expect(decision([
      { participant_id: 'user-a', state: 'accepted' },
      { participant_id: 'user-b', state: 'accepted' },
    ], { now: deadline })).toEqual({ allowed: false, state: 'expired' });

    expect(decision([], {
      currentParticipantIds: ['user-a', 'user-b', 'user-c'],
    })).toEqual({ allowed: false, state: 'participant_changed' });
    expect(decision([], {
      currentParticipantIds: ['user-a'],
    })).toEqual({ allowed: false, state: 'participant_changed' });
  });

  it('keeps unanimous consent active after the response deadline once recording began', () => {
    expect(decision([
      { participant_id: 'user-a', state: 'accepted' },
      { participant_id: 'user-b', state: 'accepted' },
    ], {
      sessionStatus: 'recording',
      now: '2026-09-10T12:30:00.000Z',
    })).toEqual({ allowed: true, state: 'recording' });
  });

  it('never starts browser capture before server authorization and leaves Free calls unchanged', () => {
    const localStream = { getAudioTracks: () => [{}] };
    expect(shouldCaptureCallSummary({
      callStatus: 'connected',
      captureAllowed: false,
      localStream,
    })).toBe(false);
    expect(shouldCaptureCallSummary({
      callStatus: 'connected',
      captureAllowed: undefined,
      localStream,
    })).toBe(false);
    expect(shouldCaptureCallSummary({
      callStatus: 'connected',
      captureAllowed: true,
      localStream,
    })).toBe(true);
  });

  it('discards local capture when consent is revoked or participant state changes', () => {
    const accepted = {
      session: { failure_code: '' },
      consents: [{ participant_id: 'user-a', state: 'accepted' }],
    };
    expect(canUploadCallCapture(accepted, 'user-a')).toBe(true);
    expect(canUploadCallCapture({
      session: { failure_code: '' },
      consents: [{ participant_id: 'user-a', state: 'call_ended' }],
    }, 'user-a')).toBe(true);
    expect(canUploadCallCapture({
      ...accepted,
      session: { failure_code: 'CONSENT_REVOKED' },
    }, 'user-a')).toBe(false);
    expect(canUploadCallCapture({
      session: { failure_code: '' },
      consents: [{ participant_id: 'user-a', state: 'revoked' }],
    }, 'user-a')).toBe(false);
  });

  it('gates creation and generation on only the canonical Premium Plus entitlement', () => {
    expect(resolveEntitlements('free', 'active')['calls.summary']).toBe(false);
    expect(resolveEntitlements('premium', 'active')['calls.summary']).toBe(false);
    expect(resolveEntitlements('premium_plus', 'active')['calls.summary']).toBe(true);
  });

  it('accepts capture URLs only from explicitly configured HTTPS hosts', () => {
    const hosts = ['uploads.example.com'];
    expect(isAllowedCaptureUrl('https://uploads.example.com/call.webm', hosts)).toBe(true);
    expect(isAllowedCaptureUrl('http://uploads.example.com/call.webm', hosts)).toBe(false);
    expect(isAllowedCaptureUrl('https://uploads.example.com.evil.test/call.webm', hosts)).toBe(false);
    expect(isAllowedCaptureUrl('https://evil.test/call.webm', hosts)).toBe(false);
  });
});

describe('call summary idempotency and retention', () => {
  it('returns the existing result for a duplicate request key', () => {
    expect(summaryRequestDisposition({
      summary: {
        status: 'failed',
        request_key: 'call_summary:session:1',
        attempts: 1,
        processing_started_at: '2026-09-10T12:00:00.000Z',
      },
      requestKey: 'call_summary:session:1',
      now: '2026-09-10T12:01:00.000Z',
    })).toBe('duplicate');
  });

  it('blocks concurrent processing, permits bounded retries, and enforces the retry limit', () => {
    const pending = {
      status: 'pending',
      request_key: 'call_summary:session:1',
      attempts: 1,
      processing_started_at: '2026-09-10T12:00:00.000Z',
    };
    expect(summaryRequestDisposition({
      summary: pending,
      requestKey: 'call_summary:session:2',
      now: '2026-09-10T12:01:00.000Z',
    })).toBe('in_progress');
    expect(summaryRequestDisposition({
      summary: { ...pending, status: 'failed' },
      requestKey: 'call_summary:session:2',
    })).toBe('retry');
    expect(summaryRequestDisposition({
      summary: { ...pending, status: 'failed', attempts: 3 },
      requestKey: 'call_summary:session:4',
    })).toBe('retry_limit');
  });

  it('limits summary visibility to call participants and the retention window', () => {
    const summary = {
      status: 'completed',
      participant_ids: participants,
      available_until: '2026-10-10T12:00:00.000Z',
    };
    expect(summaryAvailable(summary, 'user-a', '2026-10-10T11:59:59.999Z')).toBe(true);
    expect(summaryAvailable(summary, 'outsider', '2026-10-10T11:59:59.999Z')).toBe(false);
    expect(summaryAvailable(summary, 'user-a', summary.available_until)).toBe(false);
  });

  it('uses explicit two-minute consent and thirty-day result retention windows', () => {
    expect(CALL_SUMMARY_CONSENT_TTL_MS).toBe(2 * 60 * 1000);
    expect(Date.parse(retentionDeadline('2026-09-10T12:00:00.000Z')))
      .toBe(Date.parse('2026-09-10T12:00:00.000Z') + CALL_SUMMARY_RETENTION_MS);
  });
});
