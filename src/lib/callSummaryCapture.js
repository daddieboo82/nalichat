export function shouldCaptureCallSummary({ callStatus, captureAllowed, localStream }) {
  return callStatus === "connected"
    && captureAllowed === true
    && !!localStream?.getAudioTracks?.().length;
}

const TERMINAL_CAPTURE_FAILURES = new Set([
  "CONSENT_DECLINED",
  "CONSENT_REVOKED",
  "CONSENT_EXPIRED",
  "PARTICIPANTS_CHANGED",
  "CAPTURE_UNAVAILABLE",
  "CAPTURE_FAILED",
  "CALL_FAILED",
]);

export function canUploadCallCapture(data, participantId) {
  const session = data?.session;
  const consent = data?.consents?.find((item) => item.participant_id === participantId);
  if (!session || TERMINAL_CAPTURE_FAILURES.has(session.failure_code)) return false;
  return consent?.state === "accepted" || consent?.state === "call_ended";
}
