import { createClientFromRequest } from "npm:@base44/sdk@0.8.48";
import {
  readJsonBodyLimited,
  requestBodyErrorResponse,
} from "../../shared/requestLimits.ts";

// The only permitted server entrypoint for private NaliVoice checkpoints.
// No raw audio is accepted. Records are not accessible through client entity
// APIs; the signed-in account comes exclusively from verified authentication.
const error = (message: string, status: number) =>
  Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
const reply = (value: unknown) =>
  Response.json(value, { headers: { "Cache-Control": "no-store" } });
const MAX_JSON = 10000;

function validateModel(input: unknown) {
  if (!input || typeof input !== "object") return null;
  const m = input as Record<string, unknown>;
  if (
    m.format !== "nalivoice-residual-v1" || m.taps !== 9 || m.hidden !== 16 ||
    !Number.isSafeInteger(m.trainedSteps) || (m.trainedSteps as number) < 0 ||
    (m.trainedSteps as number) > 500000000 || !Number.isFinite(m.b2) ||
    !Array.isArray(m.w1) || m.w1.length !== 144 ||
    !Array.isArray(m.b1) || m.b1.length !== 16 ||
    !Array.isArray(m.w2) || m.w2.length !== 16
  ) return null;
  for (const v of [...m.w1, ...m.w2, ...m.b1, m.b2]) {
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 100) {
      return null;
    }
  }
  const encoded = JSON.stringify(input);
  return encoded.length <= MAX_JSON ? encoded : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return error("Method not allowed", 405);
  try {
    const sdk = createClientFromRequest(request);
    const user = await sdk.auth.me().catch(() => null);
    if (!user?.id || user.is_banned) return error("Sign in required", 401);
    const payload = await readJsonBodyLimited(request, 30000);
    const action = payload?.action;
    if (!["get", "set_consent", "save", "erase"].includes(action)) {
      return error("Invalid action", 400);
    }

    const entity = sdk.asServiceRole.entities.NaliVoicePrivateModel;
    const records = await entity.filter(
      { user_id: user.id },
      "-created_date",
      5,
    );
    if (!Array.isArray(records)) return error("Model store unavailable", 503);
    if (records.length > 1) {
      return error("Duplicate model record requires support review", 409);
    }
    const record = records[0] || null;

    if (action === "get") {
      return reply({
        consent: record?.consent === true,
        revision: record?.revision || 0,
        model: record?.model_json ? JSON.parse(record.model_json) : null,
      });
    }
    if (action === "set_consent") {
      if (typeof payload.enabled !== "boolean") {
        return error("Explicit consent selection required", 400);
      }
      const changes = {
        consent: payload.enabled,
        updated_at: new Date().toISOString(),
      };
      if (record) await entity.update(record.id, changes);
      else await entity.create({ user_id: user.id, revision: 0, ...changes });
      return reply({ success: true, consent: payload.enabled });
    }
    if (action === "erase") {
      // Delete the checkpoint and training permission in one server-side
      // record removal, scoped to this authenticated owner.
      if (record) await entity.delete(record.id);
      return reply({ success: true, consent: false });
    }
    if (!record || record.consent !== true) {
      return error("Private voice training is disabled", 403);
    }
    const serialized = validateModel(payload.model);
    if (!serialized) return error("Invalid NaliVoice model checkpoint", 400);
    if (
      !Number.isSafeInteger(payload.revision) ||
      payload.revision !== record.revision
    ) {
      return error(
        "Model changed on another device. Reload before training again.",
        409,
      );
    }
    // Compare revisions for early conflict detection; use of an RDBMS with
    // atomic compare-and-swap is recommended before multi-device concurrency.
    await entity.update(record.id, {
      model_json: serialized,
      revision: record.revision + 1,
      updated_at: new Date().toISOString(),
    });
    return reply({ success: true, revision: record.revision + 1 });
  } catch (cause) {
    console.error(
      "NaliVoice private model service failed",
      cause instanceof Error ? cause.message : "unknown",
    );
    return requestBodyErrorResponse(cause) ??
      error("Private voice model service unavailable", 503);
  }
});
