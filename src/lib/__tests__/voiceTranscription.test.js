import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TRANSCRIPTION_BYTES,
  MAX_TRANSCRIPTION_SECONDS,
  VoiceTranscriptionError,
  normalizeTranscript,
  probeAudioResource,
  requestVoiceTranscription,
  validateStoredAudioUrl,
  validateVoiceMessage,
} from '../../../base44/shared/voiceTranscription.ts';

const ALLOWED_AUDIO_PREFIXES = ['https://media.base44.com/audio/'];

function mutableEntity(initial = []) {
  const records = initial.map((record) => ({ ...record }));
  let sequence = records.length;
  return {
    records,
    async filter(query) {
      return records.filter((record) => (
        Object.entries(query).every(([key, value]) => record[key] === value)
      ));
    },
    async create(data) {
      const record = { id: `record-${++sequence}`, ...data };
      records.push(record);
      return record;
    },
    async update(id, patch) {
      const record = records.find((candidate) => candidate.id === id);
      Object.assign(record, patch);
      return record;
    },
    async delete(id) {
      const index = records.findIndex((candidate) => candidate.id === id);
      if (index >= 0) records.splice(index, 1);
    },
  };
}

function createBase44({
  userId = 'user-1',
  participants = ['user-1', 'user-2'],
  plan = 'premium_plus',
  message = {},
  provider = vi.fn(async () => ({ text: '  Hello from the voice note.  ' })),
} = {}) {
  const voiceTranscriptions = mutableEntity();
  const aiUsage = mutableEntity();
  const storedMessage = {
    id: 'message-1',
    conversation_id: 'conversation-1',
    type: 'audio',
    file_url: 'https://media.base44.com/audio/voice-1.webm',
    file_name: 'voice-1.webm',
    file_type: 'audio/webm;codecs=opus',
    file_size: 1024,
    duration: 12,
    ...message,
  };
  return {
    provider,
    voiceTranscriptions,
    aiUsage,
    client: {
      asServiceRole: {
        entities: {
          Message: { get: vi.fn(async (id) => id === storedMessage.id ? storedMessage : null) },
          Conversation: {
            get: vi.fn(async (id) => id === 'conversation-1'
              ? { id: 'conversation-1', participant_ids: participants }
              : null),
          },
          Subscription: {
            filter: vi.fn(async () => [{
              id: 'subscription-1',
              user_id: userId,
              plan,
              status: 'active',
            }]),
          },
          AIUsage: aiUsage,
          VoiceTranscription: voiceTranscriptions,
        },
        integrations: {
          Core: { TranscribeAudio: provider },
        },
      },
    },
  };
}

const reachableAudio = vi.fn(async () => new Response(null, {
  status: 200,
  headers: {
    'content-type': 'audio/webm',
    'content-length': '1024',
  },
}));

describe('voice transcription server contract', () => {
  it('normalizes provider output without inventing transcript text', () => {
    expect(normalizeTranscript({ text: '  hello  ' })).toBe('hello');
    expect(normalizeTranscript({ data: '  fallback  ' })).toBe('fallback');
    expect(normalizeTranscript({ result: 'not supported' })).toBe('');
  });

  it('requires authenticated conversation membership', () => {
    expect(() => validateVoiceMessage({
      conversation_id: 'conversation-1',
      type: 'audio',
      file_url: 'https://media.base44.com/audio/voice.webm',
      file_name: 'voice.webm',
      file_type: 'audio/webm',
      file_size: 100,
      duration: 2,
    }, {
      id: 'conversation-1',
      participant_ids: ['user-2'],
    }, 'user-1', ALLOWED_AUDIO_PREFIXES)).toThrowError(expect.objectContaining({
      code: 'CONVERSATION_ACCESS_DENIED',
      status: 403,
    }));
  });

  it.each([
    [{ type: 'file' }, 'UNSUPPORTED_AUDIO_TYPE'],
    [{ file_type: 'text/plain', file_name: 'note.txt' }, 'UNSUPPORTED_AUDIO_TYPE'],
    [{ file_size: MAX_TRANSCRIPTION_BYTES + 1 }, 'AUDIO_TOO_LARGE'],
    [{ duration: MAX_TRANSCRIPTION_SECONDS + 1 }, 'AUDIO_TOO_LONG'],
    [{ file_size: -1 }, 'AUDIO_SIZE_UNKNOWN'],
    [{ duration: null }, 'AUDIO_DURATION_UNKNOWN'],
  ])('rejects invalid audio metadata %#', (patch, code) => {
    expect(() => validateVoiceMessage({
      conversation_id: 'conversation-1',
      type: 'audio',
      file_url: 'https://media.base44.com/audio/voice.webm',
      file_name: 'voice.webm',
      file_type: 'audio/webm',
      file_size: 100,
      duration: 2,
      ...patch,
    }, {
      id: 'conversation-1',
      participant_ids: ['user-1'],
    }, 'user-1', ALLOWED_AUDIO_PREFIXES)).toThrowError(expect.objectContaining({ code }));
  });

  it('accepts only trusted, server-stored HTTPS audio locations', () => {
    expect(validateStoredAudioUrl(
      'https://media.base44.com/audio/voice.webm',
      ALLOWED_AUDIO_PREFIXES,
    ))
      .toBe('https://media.base44.com/audio/voice.webm');
    for (const url of [
      'http://media.base44.com/audio/voice.webm',
      'https://evil.example/audio/voice.webm',
      'https://media.base44.com:8443/audio/voice.webm',
      'https://user:secret@media.base44.com/audio/voice.webm',
    ]) {
      expect(() => validateStoredAudioUrl(url, ALLOWED_AUDIO_PREFIXES))
        .toThrow(VoiceTranscriptionError);
    }
    expect(() => validateStoredAudioUrl(
      'https://media.base44.com/other-app/voice.webm',
      ALLOWED_AUDIO_PREFIXES,
    )).toThrowError(expect.objectContaining({ code: 'UNOWNED_AUDIO_RESOURCE' }));
  });

  it('uses probed content length for legacy voice notes without stored size', async () => {
    await expect(probeAudioResource(
      'https://media.base44.com/audio/legacy.webm',
      reachableAudio,
      1000,
      false,
    )).resolves.toBeUndefined();
  });

  it('checks Premium Plus before provider dispatch or quota use', async () => {
    const fixture = createBase44({ plan: 'premium' });
    await expect(requestVoiceTranscription({
      base44: fixture.client,
      user: { id: 'user-1' },
      messageId: 'message-1',
      requestKey: 'voice-transcription:message-1',
      fetcher: reachableAudio,
      allowedAudioPrefixes: ALLOWED_AUDIO_PREFIXES,
    })).rejects.toMatchObject({
      status: 403,
      code: 'VOICE_TRANSCRIPTION_ENTITLEMENT_REQUIRED',
    });
    expect(fixture.provider).not.toHaveBeenCalled();
    expect(fixture.aiUsage.records).toHaveLength(0);
  });

  it('persists completed state and replays a duplicate key without work or quota charges', async () => {
    const fixture = createBase44();
    const input = {
      base44: fixture.client,
      user: { id: 'user-1' },
      messageId: 'message-1',
      requestKey: 'voice-transcription:message-1',
      fetcher: reachableAudio,
      allowedAudioPrefixes: ALLOWED_AUDIO_PREFIXES,
      now: new Date('2026-09-10T20:00:00.000Z'),
    };
    const first = await requestVoiceTranscription(input);
    const duplicate = await requestVoiceTranscription(input);

    expect(first.transcription).toMatchObject({
      status: 'completed',
      text: 'Hello from the voice note.',
      duplicate: false,
    });
    expect(duplicate.transcription).toMatchObject({
      status: 'completed',
      text: 'Hello from the voice note.',
      duplicate: true,
    });
    expect(fixture.provider).toHaveBeenCalledTimes(1);
    expect(fixture.aiUsage.records).toHaveLength(1);
    expect(fixture.aiUsage.records[0].status).toBe('dispatched');
    expect(fixture.voiceTranscriptions.records).toHaveLength(1);
  });

  it('persists timeout failure and does not redispatch the same retry key', async () => {
    const provider = vi.fn(() => new Promise(() => {}));
    const fixture = createBase44({ provider });
    const input = {
      base44: fixture.client,
      user: { id: 'user-1' },
      messageId: 'message-1',
      requestKey: 'voice-transcription:timeout-1',
      fetcher: reachableAudio,
      allowedAudioPrefixes: ALLOWED_AUDIO_PREFIXES,
      providerTimeoutMs: 1,
    };

    await expect(requestVoiceTranscription(input)).rejects.toMatchObject({
      code: 'PROVIDER_TIMEOUT',
      retryable: true,
    });
    const duplicate = await requestVoiceTranscription(input);
    expect(duplicate.transcription).toMatchObject({
      status: 'failed',
      error_code: 'PROVIDER_TIMEOUT',
      duplicate: true,
    });
    expect(fixture.voiceTranscriptions.records[0].error_code).toBe('PROVIDER_TIMEOUT');
    expect(provider).toHaveBeenCalledTimes(1);
    expect(fixture.aiUsage.records).toHaveLength(1);
  });

  it('expires a stale pending request so clients can offer a new attempt', async () => {
    const fixture = createBase44();
    fixture.voiceTranscriptions.records.push({
      id: 'state-stale',
      message_id: 'message-1',
      conversation_id: 'conversation-1',
      participant_ids: ['user-1', 'user-2'],
      requested_by: 'user-1',
      request_key: 'voice-transcription:stale-1',
      status: 'pending',
      started_at: '2026-09-10T19:58:00.000Z',
    });
    const result = await requestVoiceTranscription({
      base44: fixture.client,
      user: { id: 'user-1' },
      messageId: 'message-1',
      requestKey: 'voice-transcription:stale-1',
      fetcher: reachableAudio,
      allowedAudioPrefixes: ALLOWED_AUDIO_PREFIXES,
      now: new Date('2026-09-10T20:00:00.000Z'),
    });
    expect(result.transcription).toMatchObject({
      status: 'failed',
      error_code: 'STALE_TRANSCRIPTION_REQUEST',
      duplicate: true,
    });
    expect(fixture.provider).not.toHaveBeenCalled();
    expect(fixture.aiUsage.records).toHaveLength(0);
  });

  it('rejects an empty provider transcript and records a failed state', async () => {
    const fixture = createBase44({ provider: vi.fn(async () => ({ text: '   ' })) });
    await expect(requestVoiceTranscription({
      base44: fixture.client,
      user: { id: 'user-1' },
      messageId: 'message-1',
      requestKey: 'voice-transcription:empty-1',
      fetcher: reachableAudio,
      allowedAudioPrefixes: ALLOWED_AUDIO_PREFIXES,
    })).rejects.toMatchObject({ code: 'EMPTY_TRANSCRIPT' });
    expect(fixture.voiceTranscriptions.records[0]).toMatchObject({
      status: 'failed',
      error_code: 'EMPTY_TRANSCRIPT',
    });
  });

  it('handles deleted messages before touching the provider', async () => {
    const fixture = createBase44();
    await expect(requestVoiceTranscription({
      base44: fixture.client,
      user: { id: 'user-1' },
      messageId: 'deleted-message',
      requestKey: 'voice-transcription:deleted-1',
      fetcher: reachableAudio,
      allowedAudioPrefixes: ALLOWED_AUDIO_PREFIXES,
    })).rejects.toMatchObject({ status: 404, code: 'MESSAGE_NOT_FOUND' });
    expect(fixture.provider).not.toHaveBeenCalled();
  });
});
