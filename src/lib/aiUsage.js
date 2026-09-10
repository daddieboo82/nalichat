import { base44 } from "@/api/base44Client";

export const AI_QUOTA_EVENT = "nali-ai-quota";
export const AI_QUOTA_EXHAUSTED = "AI_DAILY_QUOTA_EXHAUSTED";

function payloadFrom(value) {
  return value?.response?.data ?? value?.data ?? value;
}

function emitQuota(quota) {
  if (!quota || typeof quota !== "object") return;
  window.dispatchEvent(new CustomEvent(AI_QUOTA_EVENT, { detail: quota }));
}

export function createAiRequestKey(operation, stableId) {
  const suffix = stableId || crypto.randomUUID();
  return `${operation}:${suffix}`.replace(/[^A-Za-z0-9._:-]/g, "_").slice(0, 128);
}

export function aiErrorDetails(error) {
  const payload = payloadFrom(error);
  return {
    code: payload?.code || null,
    quota: payload?.quota || null,
    message: payload?.error || error?.message || "AI request failed.",
  };
}

export function aiErrorMessage(error) {
  const details = aiErrorDetails(error);
  if (details.quota) emitQuota(details.quota);
  if (details.code === AI_QUOTA_EXHAUSTED) {
    return "You've used today's AI requests. Upgrade for more, or try again after the UTC reset.";
  }
  return details.message;
}

export async function invokeAiFunction(name, payload = {}, options = {}) {
  const requestKey = options.requestKey || createAiRequestKey(name);
  try {
    const response = await base44.functions.invoke(name, {
      ...payload,
      request_key: requestKey,
    });
    const data = payloadFrom(response);
    if (data?.error) {
      const error = new Error(data.error);
      Object.assign(error, { response: { data } });
      throw error;
    }
    emitQuota(data?.quota);
    return data;
  } catch (error) {
    const details = aiErrorDetails(error);
    if (details.quota) emitQuota(details.quota);
    throw error;
  }
}

export async function runMeteredAgentRequest(dispatch, requestKey = createAiRequestKey("assistant")) {
  const reservation = await invokeAiFunction(
    "meterAgentRequest",
    { action: "reserve" },
    { requestKey },
  );
  const reservationDay = reservation.reservation_day;
  let result;
  try {
    result = await dispatch();
  } catch (error) {
    try {
      await invokeAiFunction(
        "meterAgentRequest",
        { action: "release", reservation_day: reservationDay },
        { requestKey },
      );
    } catch (releaseError) {
      console.error("Unable to release AI quota reservation", releaseError);
    }
    throw error;
  }
  await invokeAiFunction(
    "meterAgentRequest",
    { action: "dispatch", reservation_day: reservationDay },
    { requestKey },
  );
  return result;
}
