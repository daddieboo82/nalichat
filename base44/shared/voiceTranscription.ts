import {
  AI_REQUEST_ALREADY_DISPATCHED,
  AiQuotaError,
  executeMeteredAiRequest,
} from './aiQuota.ts';
import { resolveUserSubscription } from './subscriptionAccess.ts';

export const VOICE_TRANSCRIPTION_ENTITLEMENT = 'voice.transcription';
export const MAX_TRANSCRIPTION_BYTES = 25 * 1024 * 1024;
export const MAX_TRANSCRIPTION_SECONDS = 10 * 60;
export const TRANSCRIPTION_PROVIDER_TIMEOUT_MS = 60_000;
export const TRANSCRIPTION_PENDING_TTL_MS = 90_000;

const REQUEST_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const AUDIO_EXTENSIONS = /\.(aac|flac|m4a|mp3|mp4|ogg|wav|webm)$/i;
const TRUSTED_STORAGE_HOSTS = [
  'storage.googleapis.com',
  'base44-user-files.s3.amazonaws.com',
  'base44-user-files.s3.us-east-1.amazonaws.com',
  'files.base44.com',
  'cdn.base44.com',
  'media.base44.com',
] as const;

export class VoiceTranscriptionError extends Error {
  status: number;
  code: string;
  retryable: boolean;

  constructor(status: number, code: string, message: string, retryable = false) {
    super(message);
    this.name = 'VoiceTranscriptionError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export function normalizeTranscript(value: unknown): string {
  const candidate = typeof value === 'string'
    ? value
    : (
      value && typeof value === 'object'
        ? (value as { text?: unknown; data?: unknown }).text
          ?? (value as { data?: unknown }).data
        : ''
    );
  return typeof candidate === 'string' ? candidate.trim() : '';
}

export function validateTranscriptionRequestKey(value: unknown): string {
  if (typeof value !== 'string' || !REQUEST_KEY_PATTERN.test(value)) {
    throw new VoiceTranscriptionError(
      400,
      'INVALID_REQUEST_KEY',
      'A valid request_key is required.',
    );
  }
  return value;
}

export function configuredAudioUrlPrefixes(rawValue?: string | null): string[] {
  const configured = rawValue ?? (globalThis as any).Deno?.env?.get(
    'TRANSCRIPTION_ALLOWED_AUDIO_PREFIXES',
  );
  if (typeof configured !== 'string') return [];
  return configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function validateStoredAudioUrl(
  value: unknown,
  allowedPrefixes = configuredAudioUrlPrefixes(),
): string {
  if (typeof value !== 'string' || !value) {
    throw new VoiceTranscriptionError(410, 'AUDIO_UNAVAILABLE', 'The voice note is no longer available.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new VoiceTranscriptionError(400, 'INVALID_AUDIO_URL', 'The voice note URL is invalid.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const trusted = TRUSTED_STORAGE_HOSTS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`),
  );
  if (
    parsed.protocol !== 'https:'
    || parsed.username
    || parsed.password
    || parsed.port
    || parsed.hash
    || !trusted
  ) {
    throw new VoiceTranscriptionError(
      400,
      'UNTRUSTED_AUDIO_URL',
      'The voice note is not stored in an approved location.',
    );
  }
  if (!allowedPrefixes.length) {
    throw new VoiceTranscriptionError(
      503,
      'TRANSCRIPTION_STORAGE_NOT_CONFIGURED',
      'Voice-note transcription storage is not configured.',
    );
  }
  const belongsToAppStorage = allowedPrefixes.some((prefixValue) => {
    try {
      const prefix = new URL(prefixValue);
      return prefix.protocol === 'https:'
        && prefix.username === ''
        && prefix.password === ''
        && prefix.port === ''
        && prefix.hash === ''
        && prefix.search === ''
        && prefix.pathname.endsWith('/')
        && parsed.origin === prefix.origin
        && parsed.pathname.startsWith(prefix.pathname);
    } catch {
      return false;
    }
  });
  if (!belongsToAppStorage) {
    throw new VoiceTranscriptionError(
      400,
      'UNOWNED_AUDIO_RESOURCE',
      'The voice note does not belong to this application.',
    );
  }
  return parsed.toString();
}

export function validateVoiceMessage(
  message: Record<string, unknown>,
  conversation: Record<string, unknown>,
  userId: string,
  allowedAudioPrefixes = configuredAudioUrlPrefixes(),
) {
  const participants = Array.isArray(conversation.participant_ids)
    ? conversation.participant_ids.filter((value): value is string => typeof value === 'string')
    : [];
  if (!participants.includes(userId)) {
    throw new VoiceTranscriptionError(
      403,
      'CONVERSATION_ACCESS_DENIED',
      'You do not have access to this voice note.',
    );
  }
  if (message.conversation_id !== conversation.id) {
    throw new VoiceTranscriptionError(
      403,
      'MESSAGE_ACCESS_DENIED',
      'You do not have access to this voice note.',
    );
  }
  if (message.type !== 'audio') {
    throw new VoiceTranscriptionError(
      400,
      'UNSUPPORTED_AUDIO_TYPE',
      'Only voice-note audio messages can be transcribed.',
    );
  }

  const mime = typeof message.file_type === 'string'
    ? message.file_type.split(';', 1)[0].trim().toLowerCase()
    : '';
  const fileName = typeof message.file_name === 'string' ? message.file_name : '';
  if (!mime.startsWith('audio/') && !AUDIO_EXTENSIONS.test(fileName)) {
    throw new VoiceTranscriptionError(
      415,
      'UNSUPPORTED_AUDIO_TYPE',
      'This audio format is not supported for transcription.',
    );
  }

  const fileSize = Number(message.file_size);
  const hasStoredFileSize = message.file_size !== null
    && message.file_size !== undefined
    && message.file_size !== '';
  if (hasStoredFileSize && (!Number.isFinite(fileSize) || fileSize <= 0)) {
    throw new VoiceTranscriptionError(
      400,
      'AUDIO_SIZE_UNKNOWN',
      'This voice note is missing the size metadata required for transcription.',
    );
  }
  if (hasStoredFileSize && fileSize > MAX_TRANSCRIPTION_BYTES) {
    throw new VoiceTranscriptionError(
      413,
      'AUDIO_TOO_LARGE',
      'Voice notes must be 25 MB or smaller to transcribe.',
    );
  }

  const duration = Number(message.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new VoiceTranscriptionError(
      400,
      'AUDIO_DURATION_UNKNOWN',
      'This voice note is missing the duration metadata required for transcription.',
    );
  }
  if (duration > MAX_TRANSCRIPTION_SECONDS) {
    throw new VoiceTranscriptionError(
      413,
      'AUDIO_TOO_LONG',
      'Voice notes must be 10 minutes or shorter to transcribe.',
    );
  }

  return {
    audioUrl: validateStoredAudioUrl(message.file_url, allowedAudioPrefixes),
    hasStoredFileSize,
    participants,
  };
}

export async function probeAudioResource(
  audioUrl: string,
  fetcher: typeof fetch = fetch,
  timeoutMs = 10_000,
  hasStoredFileSize = true,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetcher(audioUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
    });
    if (response.status === 405 || response.status === 501) {
      response = await fetcher(audioUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'manual',
        signal: controller.signal,
      });
      await response.body?.cancel();
    }
  } catch {
    throw new VoiceTranscriptionError(
      410,
      'AUDIO_UNAVAILABLE',
      'The voice note could not be accessed.',
      true,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new VoiceTranscriptionError(
      410,
      'AUDIO_UNAVAILABLE',
      'The voice note could not be accessed.',
      true,
    );
  }
  if (response.status >= 300 && response.status < 400) {
    throw new VoiceTranscriptionError(
      400,
      'UNTRUSTED_AUDIO_REDIRECT',
      'The voice note redirected outside approved storage.',
    );
  }

  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType && !contentType.startsWith('audio/')) {
    throw new VoiceTranscriptionError(
      415,
      'UNSUPPORTED_AUDIO_TYPE',
      'The stored resource is not recognized as audio.',
    );
  }
  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? null : Number(contentLengthHeader);
  if (
    contentLength !== null
    && Number.isFinite(contentLength)
    && contentLength > MAX_TRANSCRIPTION_BYTES
  ) {
    throw new VoiceTranscriptionError(
      413,
      'AUDIO_TOO_LARGE',
      'Voice notes must be 25 MB or smaller to transcribe.',
    );
  }
  if (
    !hasStoredFileSize
    && (
      contentLength === null
      || !Number.isFinite(contentLength)
      || contentLength <= 0
    )
  ) {
    throw new VoiceTranscriptionError(
      400,
      'AUDIO_SIZE_UNKNOWN',
      'The voice note size could not be verified.',
    );
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new VoiceTranscriptionError(
      504,
      'PROVIDER_TIMEOUT',
      'Transcription timed out. You can start a new attempt.',
      true,
    )), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function publicState(record: Record<string, unknown>, duplicate = false) {
  return {
    id: record.id,
    message_id: record.message_id,
    status: record.status,
    text: record.status === 'completed' && typeof record.transcript === 'string'
      ? record.transcript
      : '',
    error_code: record.status === 'failed' && typeof record.error_code === 'string'
      ? record.error_code
      : null,
    duplicate,
  };
}

async function updateFailure(entity: any, id: string, error: unknown, now: string) {
  const code = error instanceof AiQuotaError || error instanceof VoiceTranscriptionError
    ? error.code
    : 'PROVIDER_ERROR';
  try {
    return await entity.update(id, {
      status: 'failed',
      error_code: code,
      completed_at: now,
    });
  } catch (updateError) {
    console.error('Unable to persist transcription failure state:', updateError);
    return null;
  }
}

export async function requestVoiceTranscription({
  base44,
  user,
  messageId,
  requestKey,
  now = new Date(),
  fetcher = fetch,
  providerTimeoutMs = TRANSCRIPTION_PROVIDER_TIMEOUT_MS,
  allowedAudioPrefixes = configuredAudioUrlPrefixes(),
}: {
  base44: any;
  user: { id: string };
  messageId: unknown;
  requestKey: unknown;
  now?: Date;
  fetcher?: typeof fetch;
  providerTimeoutMs?: number;
  allowedAudioPrefixes?: string[];
}) {
  if (typeof messageId !== 'string' || !messageId) {
    throw new VoiceTranscriptionError(400, 'INVALID_MESSAGE_ID', 'message_id is required.');
  }
  const normalizedRequestKey = validateTranscriptionRequestKey(requestKey);
  const message = await base44.asServiceRole.entities.Message.get(messageId);
  if (!message) {
    throw new VoiceTranscriptionError(404, 'MESSAGE_NOT_FOUND', 'The voice note was not found.');
  }
  const conversation = await base44.asServiceRole.entities.Conversation.get(message.conversation_id);
  if (!conversation) {
    throw new VoiceTranscriptionError(404, 'CONVERSATION_NOT_FOUND', 'The conversation was not found.');
  }
  const validated = validateVoiceMessage(
    message,
    conversation,
    user.id,
    allowedAudioPrefixes,
  );
  const access = await resolveUserSubscription(
    base44.asServiceRole.entities.Subscription,
    user.id,
    now.toISOString(),
  );
  if (access.entitlements[VOICE_TRANSCRIPTION_ENTITLEMENT] !== true) {
    throw new VoiceTranscriptionError(
      403,
      'VOICE_TRANSCRIPTION_ENTITLEMENT_REQUIRED',
      'Voice-note transcription requires Premium Plus.',
    );
  }

  const existing = await base44.asServiceRole.entities.VoiceTranscription.filter(
    { message_id: messageId },
    '-created_date',
    100,
  );
  const completed = existing.find((record: Record<string, unknown>) => record.status === 'completed');
  if (completed) return { transcription: publicState(completed, true), quota: null };
  const duplicate = existing.find((record: Record<string, unknown>) => (
    record.requested_by === user.id && record.request_key === normalizedRequestKey
  ));
  if (duplicate) {
    const startedAt = typeof duplicate.started_at === 'string'
      ? Date.parse(duplicate.started_at)
      : Number.NaN;
    const isStalePending = duplicate.status === 'pending'
      && (
        !Number.isFinite(startedAt)
        || now.getTime() - startedAt >= TRANSCRIPTION_PENDING_TTL_MS
      );
    if (isStalePending) {
      const failed = await base44.asServiceRole.entities.VoiceTranscription.update(duplicate.id, {
        status: 'failed',
        error_code: 'STALE_TRANSCRIPTION_REQUEST',
        completed_at: now.toISOString(),
      });
      return { transcription: publicState(failed, true), quota: null };
    }
    return { transcription: publicState(duplicate, true), quota: null };
  }

  await probeAudioResource(
    validated.audioUrl,
    fetcher,
    10_000,
    validated.hasStoredFileSize,
  );

  const startedAt = now.toISOString();
  const state = await base44.asServiceRole.entities.VoiceTranscription.create({
    message_id: messageId,
    conversation_id: conversation.id,
    participant_ids: validated.participants,
    requested_by: user.id,
    request_key: normalizedRequestKey,
    status: 'pending',
    transcript: '',
    error_code: null,
    started_at: startedAt,
    completed_at: null,
  });

  try {
    const { result, quota } = await executeMeteredAiRequest({
      base44,
      user,
      operation: 'voice_transcription',
      requestKey: normalizedRequestKey,
      now,
      dispatch: () => withTimeout(
        base44.asServiceRole.integrations.Core.TranscribeAudio({
          audio_url: validated.audioUrl,
        }),
        providerTimeoutMs,
      ),
    });
    const transcript = normalizeTranscript(result);
    if (!transcript) {
      throw new VoiceTranscriptionError(
        422,
        'EMPTY_TRANSCRIPT',
        'No speech could be transcribed from this voice note.',
        true,
      );
    }
    const completedState = await base44.asServiceRole.entities.VoiceTranscription.update(state.id, {
      status: 'completed',
      transcript,
      error_code: null,
      completed_at: new Date().toISOString(),
    });
    return { transcription: publicState(completedState), quota };
  } catch (error) {
    if (error instanceof AiQuotaError && error.code === AI_REQUEST_ALREADY_DISPATCHED) {
      const refreshed = await base44.asServiceRole.entities.VoiceTranscription.filter(
        { message_id: messageId, requested_by: user.id, request_key: normalizedRequestKey },
        '-created_date',
        1,
      );
      if (refreshed[0]?.status === 'completed') {
        return { transcription: publicState(refreshed[0], true), quota: error.quota };
      }
    }
    await updateFailure(
      base44.asServiceRole.entities.VoiceTranscription,
      state.id,
      error,
      new Date().toISOString(),
    );
    if (error instanceof AiQuotaError || error instanceof VoiceTranscriptionError) throw error;
    throw new VoiceTranscriptionError(
      502,
      'PROVIDER_ERROR',
      'The transcription provider could not process this voice note.',
      true,
    );
  }
}

export function voiceTranscriptionErrorResponse(error: VoiceTranscriptionError): Response {
  return Response.json({
    error: error.message,
    code: error.code,
    retryable: error.retryable,
  }, { status: error.status });
}
