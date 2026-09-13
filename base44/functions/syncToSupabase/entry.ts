import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { supabaseUpsert } from "../../shared/supabase.ts";
import { consumeHourlyLimit } from "../../shared/rateLimit.ts";
import { readJsonBodyLimited, requestBodyErrorResponse } from "../../shared/requestLimits.ts";

const ENTITY_TABLE_MAP = {
  User: "users",
  Conversation: "conversation",
  Message: "message",
  Project: "project",
  Track: "track",
  ArtPost: "artpost",
  Challenge: "challenge",
  ChallengeSubmission: "challengesubmission",
};

function getEntityService(base44, entityName) {
  const svc = base44.asServiceRole.entities;
  switch (entityName) {
    case "User": return svc.User;
    case "Conversation": return svc.Conversation;
    case "Message": return svc.Message;
    case "Project": return svc.Project;
    case "Track": return svc.Track;
    case "ArtPost": return svc.ArtPost;
    case "Challenge": return svc.Challenge;
    case "ChallengeSubmission": return svc.ChallengeSubmission;
    default: throw new Error(`Unknown entity: ${entityName}`);
  }
}

async function syncEntity(base44, entityName, tableName) {
  const entity = getEntityService(base44, entityName);
  const pageSize = 200;
  let synced = 0;

  for (let skip = 0; ; skip += pageSize) {
    const records = await entity.list("-created_date", pageSize, skip);
    if (!records || records.length === 0) break;

    await supabaseUpsert(tableName, records);
    synced += records.length;

    if (records.length < pageSize) break;
  }

  return { entity: entityName, table: tableName, synced };
}

export default async function (req) {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }
    if (user.is_banned) return Response.json({ error: 'banned' }, { status: 403 });
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const adminRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'admin_supabase_sync',
      12,
    );
    if (!adminRate.allowed) {
      return Response.json({ error: 'Admin operation rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const body = await readJsonBodyLimited(req, 8 * 1024);
    const entityParam = body.entity;

    const results = [];

    if (entityParam) {
      const tableName = ENTITY_TABLE_MAP[entityParam];
      if (!tableName) {
        return Response.json(
          { error: `Unknown entity: ${entityParam}`, available: Object.keys(ENTITY_TABLE_MAP) },
          { status: 400 }
        );
      }
      results.push(await syncEntity(base44, entityParam, tableName));
    } else {
      for (const [entityName, tableName] of Object.entries(ENTITY_TABLE_MAP)) {
        try {
          results.push(await syncEntity(base44, entityName, tableName));
        } catch (e) {
          console.error(`syncToSupabase ${entityName} failed:`, e);
          results.push({ entity: entityName, table: tableName, error: 'Sync failed' });
        }
      }
    }

    return Response.json({ results });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error("syncToSupabase error:", error);
    return Response.json({ error: 'Supabase sync failed' }, { status: 500 });
  }
}