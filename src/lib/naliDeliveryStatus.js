// A transport failure after dispatch begins does not prove the server rejected
// the message. Never suggest a new submission until history is checked.
export function isUncertainAiDelivery(error) {
  const code = error?.response?.data?.code || error?.data?.code || error?.code;
  if (code === 'AI_REQUEST_IN_PROGRESS' || code === 'AI_REQUEST_ALREADY_DISPATCHED') return true;
  // Explicit policy, entitlement, quota, and validation failures were rejected.
  if (typeof code === 'string' && /^(AI_DAILY_QUOTA_EXHAUSTED|AI_NOT_ENTITLED|AI_BEST_MODEL_NOT_ENTITLED|AI_REQUEST_INVALID|AI_BAD_REQUEST)$/.test(code)) return false;
  const status = Number(error?.response?.status || error?.status || error?.statusCode);
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  // Missing HTTP response or 5xx/gateway/timeout responses are ambiguous.
  return true;
}
