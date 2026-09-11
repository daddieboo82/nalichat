import { base44 } from "@/api/base44Client";

export const DEFAULT_AI_CAPABILITIES = Object.freeze({
  modes: Object.freeze({
    standard: Object.freeze({
      available: true,
      entitled: true,
      latencyClass: "provider_managed",
    }),
    deep: Object.freeze({
      available: false,
      entitled: false,
      reason: "unverified",
      latencyClass: null,
    }),
  }),
});

export function normalizeAiCapabilities(value) {
  const source = value?.data ?? value;
  const modes = source?.modes && typeof source.modes === "object" ? source.modes : {};
  const standard = modes.standard && typeof modes.standard === "object" ? modes.standard : {};
  const deep = modes.deep && typeof modes.deep === "object" ? modes.deep : {};
  return Object.freeze({
    modes: Object.freeze({
      standard: Object.freeze({
        available: true,
        entitled: true,
        latencyClass: typeof standard.latency_class === "string"
          ? standard.latency_class
          : "provider_managed",
      }),
      deep: Object.freeze({
        available: deep.available === true,
        entitled: deep.entitled === true,
        reason: typeof deep.reason === "string" ? deep.reason : null,
        latencyClass: typeof deep.latency_class === "string" ? deep.latency_class : null,
      }),
    }),
  });
}

export async function getAiCapabilities() {
  const response = await base44.functions.invoke("getAiCapabilities", {});
  const payload = response?.data ?? response;
  if (!payload || typeof payload !== "object" || payload.error) {
    throw new Error(payload?.error || "Unable to load AI capabilities.");
  }
  return normalizeAiCapabilities(payload);
}
