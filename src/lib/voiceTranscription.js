import {
  AI_QUOTA_EXHAUSTED,
  aiErrorDetails,
  createAiRequestKey,
  invokeAiFunction,
} from "@/lib/aiUsage";

const completedTranscriptions = new Map();
const VALID_STATUSES = new Set(["pending", "completed", "failed"]);

export function createTranscriptionRequestKey(messageId, attemptId = "") {
  const stableId = attemptId ? `${messageId}:retry:${attemptId}` : messageId;
  return createAiRequestKey("voice-transcription", stableId);
}

export function normalizeTranscriptionState(value) {
  const source = value?.transcription && typeof value.transcription === "object"
    ? value.transcription
    : value;
  if (!source || typeof source !== "object" || !VALID_STATUSES.has(source.status)) {
    return {
      status: "failed",
      text: "",
      errorCode: "INVALID_TRANSCRIPTION_RESPONSE",
      duplicate: false,
    };
  }
  const text = source.status === "completed" && typeof source.text === "string"
    ? source.text.trim()
    : "";
  if (source.status === "completed" && !text) {
    return {
      status: "failed",
      text: "",
      errorCode: "EMPTY_TRANSCRIPT",
      duplicate: source.duplicate === true,
    };
  }
  return {
    status: source.status,
    text,
    errorCode: typeof source.error_code === "string" ? source.error_code : null,
    duplicate: source.duplicate === true,
  };
}

export function transcriptionErrorDetails(error) {
  const details = aiErrorDetails(error);
  const messages = {
    VOICE_TRANSCRIPTION_ENTITLEMENT_REQUIRED: "Voice-note transcription requires Premium Plus.",
    MESSAGE_NOT_FOUND: "This voice note was deleted or is no longer available.",
    AUDIO_UNAVAILABLE: "The voice note could not be accessed. It may have been deleted.",
    UNSUPPORTED_AUDIO_TYPE: "This voice note uses an unsupported audio format.",
    AUDIO_TOO_LARGE: "Voice notes must be 25 MB or smaller to transcribe.",
    AUDIO_TOO_LONG: "Voice notes must be 10 minutes or shorter to transcribe.",
    AUDIO_SIZE_UNKNOWN: "This voice note is missing size information required for transcription.",
    AUDIO_DURATION_UNKNOWN: "This voice note is missing duration information required for transcription.",
    PROVIDER_TIMEOUT: "Transcription timed out. Try a new attempt.",
    PROVIDER_ERROR: "The transcription provider could not process this voice note.",
    EMPTY_TRANSCRIPT: "No speech could be transcribed from this voice note.",
    STALE_TRANSCRIPTION_REQUEST: "The previous transcription stopped before it completed.",
    TRANSCRIPTION_STORAGE_NOT_CONFIGURED: "Voice-note transcription is temporarily unavailable.",
  };
  return {
    ...details,
    isQuotaExhausted: details.code === AI_QUOTA_EXHAUSTED,
    retryable: details.code === "PROVIDER_TIMEOUT"
      || details.code === "PROVIDER_ERROR"
      || details.code === "EMPTY_TRANSCRIPT"
      || details.code === "AUDIO_UNAVAILABLE",
    message: details.code === AI_QUOTA_EXHAUSTED
      ? "You've used today's AI requests. Upgrade for more, or try again after the UTC reset."
      : messages[details.code] || "Unable to transcribe this voice note.",
  };
}

export async function requestVoiceTranscription(messageId, requestKey) {
  if (completedTranscriptions.has(messageId)) {
    return completedTranscriptions.get(messageId);
  }
  const response = await invokeAiFunction(
    "transcribeAudio",
    { message_id: messageId },
    { requestKey },
  );
  const state = normalizeTranscriptionState(response);
  if (state.status === "completed") completedTranscriptions.set(messageId, state);
  return state;
}

export function clearTranscriptionCache(messageId) {
  completedTranscriptions.delete(messageId);
}
