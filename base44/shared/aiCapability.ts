import { executeMeteredAiRequest } from './aiQuota.ts';
import { resolveUserSubscription } from './subscriptionAccess.ts';

export const AI_MODE_NOT_ENTITLED = 'AI_MODE_NOT_ENTITLED';
export const AI_MODE_UNAVAILABLE = 'AI_MODE_UNAVAILABLE';
export const AI_MODE_INVALID = 'AI_MODE_INVALID';
export const AI_MODEL_OVERRIDE_FORBIDDEN = 'AI_MODEL_OVERRIDE_FORBIDDEN';

export const AI_MODES = ['standard', 'deep'] as const;
export type AiMode = (typeof AI_MODES)[number];
type EnvironmentReader = (name: string) => string | undefined;
type SubscriptionAccess = Awaited<ReturnType<typeof resolveUserSubscription>>;

const RAW_CONTROL_KEYS = [
  'model',
  'provider',
  'reasoning',
  'reasoning_effort',
  'reasoningEffort',
] as const;

export class AiCapabilityError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'AiCapabilityError';
    this.status = status;
    this.code = code;
  }
}

function enabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function configuredModels(readEnvironment: EnvironmentReader): Set<string> {
  return new Set(
    (readEnvironment('NALI_AI_MODEL_ALLOWLIST') || '')
      .split(',')
      .map((model) => model.trim())
      .filter(Boolean),
  );
}

export function readAiProviderConfiguration(readEnvironment: EnvironmentReader) {
  const deepEnabled = enabled(readEnvironment('NALI_AI_DEEP_MODE_ENABLED'));
  const deepModel = readEnvironment('NALI_AI_DEEP_MODEL')?.trim() || null;
  const allowlist = configuredModels(readEnvironment);

  let status:
    | 'configured'
    | 'feature_disabled'
    | 'model_missing'
    | 'allowlist_missing'
    | 'model_not_allowlisted';
  if (!deepEnabled) status = 'feature_disabled';
  else if (!deepModel) status = 'model_missing';
  else if (allowlist.size === 0) status = 'allowlist_missing';
  else if (!allowlist.has(deepModel)) status = 'model_not_allowlisted';
  else status = 'configured';

  return {
    deepEnabled,
    deepModel,
    allowlist,
    status,
    deepAvailable: status === 'configured',
  };
}

export function requestedAiMode(body: unknown): AiMode {
  const input = body && typeof body === 'object'
    ? body as Record<string, unknown>
    : {};
  const rawControl = RAW_CONTROL_KEYS.find((key) => (
    Object.prototype.hasOwnProperty.call(input, key)
  ));
  if (rawControl) {
    throw new AiCapabilityError(
      400,
      AI_MODEL_OVERRIDE_FORBIDDEN,
      'Model and provider controls are server-managed.',
    );
  }

  const requested = input.ai_mode ?? 'standard';
  if (requested !== 'standard' && requested !== 'deep') {
    throw new AiCapabilityError(
      400,
      AI_MODE_INVALID,
      'AI mode must be standard or deep.',
    );
  }
  return requested;
}

export function resolveProviderManagedAiCapability({
  requestedMode,
  access,
  readEnvironment,
}: {
  requestedMode: AiMode;
  access: Pick<SubscriptionAccess, 'entitlements'>;
  readEnvironment: EnvironmentReader;
}) {
  const provider = readAiProviderConfiguration(readEnvironment);
  if (requestedMode === 'deep' && !access.entitlements['ai.best_model']) {
    throw new AiCapabilityError(
      403,
      AI_MODE_NOT_ENTITLED,
      'Deep analysis requires Premium Plus.',
    );
  }
  if (requestedMode === 'deep') {
    throw new AiCapabilityError(
      503,
      AI_MODE_UNAVAILABLE,
      'Deep analysis is not supported for this AI operation.',
    );
  }
  return {
    mode: 'standard' as const,
    invokeOptions: {},
    entitlementDecision: 'standard_allowed' as const,
    latencyClass: 'provider_managed' as const,
    providerConfigurationStatus: provider.status,
  };
}

export function resolveAiCapability({
  requestedMode,
  access,
  readEnvironment,
}: {
  requestedMode: AiMode;
  access: Pick<SubscriptionAccess, 'entitlements'>;
  readEnvironment: EnvironmentReader;
}) {
  const provider = readAiProviderConfiguration(readEnvironment);

  if (requestedMode === 'standard') {
    return {
      mode: 'standard' as const,
      invokeOptions: {},
      entitlementDecision: 'standard_allowed' as const,
      latencyClass: 'provider_managed' as const,
      providerConfigurationStatus: provider.status,
    };
  }

  if (!access.entitlements['ai.best_model']) {
    throw new AiCapabilityError(
      403,
      AI_MODE_NOT_ENTITLED,
      'Deep analysis requires Premium Plus.',
    );
  }
  if (!provider.deepAvailable || !provider.deepModel) {
    throw new AiCapabilityError(
      503,
      AI_MODE_UNAVAILABLE,
      'Deep analysis is not available with the configured AI provider.',
    );
  }

  return {
    mode: 'deep' as const,
    invokeOptions: { model: provider.deepModel },
    entitlementDecision: 'best_model_allowed' as const,
    latencyClass: 'configured_deep' as const,
    providerConfigurationStatus: provider.status,
  };
}

export async function describeAiCapabilities({
  base44,
  user,
  readEnvironment,
  now = new Date(),
}: {
  base44: {
    asServiceRole: {
      entities: {
        Subscription: Parameters<typeof resolveUserSubscription>[0];
      };
    };
  };
  user: { id: string };
  readEnvironment: EnvironmentReader;
  now?: string | Date;
}) {
  const date = now instanceof Date ? now : new Date(now);
  const access = await resolveUserSubscription(
    base44.asServiceRole.entities.Subscription,
    user.id,
    date.toISOString(),
  );
  const provider = readAiProviderConfiguration(readEnvironment);
  return {
    modes: {
      standard: {
        available: true,
        entitled: true,
        latency_class: 'provider_managed',
      },
      deep: {
        available: provider.deepAvailable,
        entitled: access.entitlements['ai.best_model'],
        reason: provider.deepAvailable ? null : provider.status,
        latency_class: provider.deepAvailable ? 'configured_deep' : null,
      },
    },
  };
}

function telemetry(fields: Record<string, unknown>) {
  console.info(JSON.stringify({
    event: 'ai_capability',
    ...fields,
  }));
}

function failureCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return 'AI_PROVIDER_ERROR';
}

export async function executeRoutedAiRequest<T>({
  base44,
  user,
  operation,
  requestKey,
  requestBody,
  readEnvironment,
  dispatch,
  supportsDeepMode = true,
  now = new Date(),
}: {
  base44: Parameters<typeof executeMeteredAiRequest<T>>[0]['base44'];
  user: { id: string };
  operation: string;
  requestKey: unknown;
  requestBody: unknown;
  readEnvironment: EnvironmentReader;
  dispatch: (invokeOptions: { model?: string }) => Promise<T>;
  supportsDeepMode?: boolean;
  now?: string | Date;
}) {
  const startedAt = Date.now();
  let mode: AiMode = 'standard';
  let entitlementDecision = 'not_evaluated';
  let providerConfigurationStatus = 'not_evaluated';
  let latencyClass = 'provider_managed';
  try {
    mode = requestedAiMode(requestBody);
    const provider = readAiProviderConfiguration(readEnvironment);
    providerConfigurationStatus = provider.status;
    latencyClass = mode === 'deep' && provider.deepAvailable
      ? 'configured_deep'
      : 'provider_managed';
    const date = now instanceof Date ? now : new Date(now);
    const access = await resolveUserSubscription(
      base44.asServiceRole.entities.Subscription,
      user.id,
      date.toISOString(),
    );
    const capability = supportsDeepMode
      ? resolveAiCapability({ requestedMode: mode, access, readEnvironment })
      : resolveProviderManagedAiCapability({ requestedMode: mode, access, readEnvironment });
    providerConfigurationStatus = capability.providerConfigurationStatus;
    latencyClass = capability.latencyClass;
    entitlementDecision = capability.entitlementDecision;
    telemetry({
      operation,
      mode,
      entitlement_decision: entitlementDecision,
      latency_class: latencyClass,
      provider_configuration_status: providerConfigurationStatus,
      outcome: 'allowed',
    });

    const response = await executeMeteredAiRequest({
      base44,
      user,
      operation,
      requestKey,
      access,
      now,
      dispatch: () => dispatch(capability.invokeOptions),
    });
    telemetry({
      operation,
      mode,
      entitlement_decision: entitlementDecision,
      latency_class: latencyClass,
      provider_configuration_status: providerConfigurationStatus,
      outcome: 'success',
      failure_code: null,
      duration_ms: Date.now() - startedAt,
    });
    return {
      ...response,
      capability: { mode, latency_class: latencyClass },
    };
  } catch (error) {
    telemetry({
      operation,
      mode,
      entitlement_decision: error instanceof AiCapabilityError ? 'denied' : entitlementDecision,
      latency_class: latencyClass,
      provider_configuration_status: providerConfigurationStatus,
      outcome: 'failure',
      failure_code: failureCode(error),
      duration_ms: Date.now() - startedAt,
    });
    throw error;
  }
}

export function aiCapabilityErrorResponse(error: AiCapabilityError): Response {
  return Response.json({
    error: error.message,
    code: error.code,
  }, { status: error.status });
}
