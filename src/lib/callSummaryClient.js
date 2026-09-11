import { base44 } from "@/api/base44Client";

export const CALL_SUMMARY_POLL_MS = 2500;

function payloadFrom(value) {
  return value?.response?.data ?? value?.data ?? value;
}

export function callSummaryError(error) {
  const payload = payloadFrom(error);
  return {
    code: payload?.code || "CALL_SUMMARY_ERROR",
    message: payload?.error || error?.message || "Call summary request failed.",
    quota: payload?.quota || null,
  };
}

export async function invokeCallSummary(action, payload = {}) {
  try {
    const response = await base44.functions.invoke("callSummarySession", { action, ...payload });
    const data = payloadFrom(response);
    if (data?.error) {
      const error = new Error(data.error);
      Object.assign(error, { response: { data } });
      throw error;
    }
    return data;
  } catch (error) {
    throw Object.assign(new Error(callSummaryError(error).message), {
      callSummary: callSummaryError(error),
    });
  }
}

export function callSummaryStatusMessage(data) {
  if (!data?.session) return "";
  if (data.summary?.status === "pending") return "Generating summary...";
  if (data.summary?.status === "failed") {
    if (data.summary.error_code === "NO_SPEECH") return "No speech was detected in the consented audio.";
    if (data.summary.error_code === "PROVIDER_TIMEOUT") return "The transcription provider timed out. You can retry.";
    return "Summary generation failed. You can retry.";
  }
  if (data.summary?.status === "completed") return "Summary ready";
  if (data.session.failure_code === "CONSENT_DECLINED") return "A participant declined. Nothing more will be captured.";
  if (data.session.failure_code === "CONSENT_REVOKED") return "Consent was revoked. Capture stopped.";
  if (data.session.failure_code === "CONSENT_EXPIRED") return "The consent request expired.";
  if (data.session.failure_code === "PARTICIPANTS_CHANGED") return "Participants changed. Capture stopped.";
  if (data.session.failure_code === "CAPTURE_UNAVAILABLE") return "A participant cannot record local audio on this device.";
  if (data.session.failure_code === "CAPTURE_FAILED") return "A local capture could not be uploaded.";
  if (data.session.failure_code === "CAPTURES_INCOMPLETE") return "Not every consented local capture arrived before the upload deadline.";
  if (data.session.status === "recording") return "Recording and transcription capture active";
  if (data.session.status === "consent_pending") return "Waiting for every participant to consent";
  if (data.session.status === "ended") return "Call ended. Waiting for consented audio uploads.";
  return "";
}
