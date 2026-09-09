import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { supabaseUpsert } from "../../shared/supabase.ts";

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

async function getEntityRecords(base44, entityName) {
  const svc = base44.asServiceRole.entities;
  switch (entityName) {
    case "User": return await svc.User.list("-created_date", 500);
    case "Conversation": return await svc.Conversation.list("-created_date", 500);
    case "Message": return await svc.Message.list("-created_date", 500);
    case "Project": return await svc.Project.list("-created_date", 500);
    case "Track": return await svc.Track.list("-created_date", 500);
    case "ArtPost": return await svc.ArtPost.list("-created_date", 500);
    case "Challenge": return await svc.Challenge.list("-created_date", 500);
    case "ChallengeSubmission": return await svc.ChallengeSubmission.list("-created_date", 500);
    default: throw new Error(`Unknown entity: ${entityName}`);
  }
}

async function syncEntity(base44, entityName, tableName) {
  const records = await getEntityRecords(base44, entityName);
  if (!records || records.length === 0) {
    return { entity: entityName, table: tableName, synced: 0 };
  }
  await supabaseUpsert(tableName, records);
  return { entity: entityName, table: tableName, synced: records.length };
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    let body = {};
    try { body = await req.json(); } catch {}
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
          results.push({ entity: entityName, table: tableName, error: e.message });
        }
      }
    }

    return Response.json({ results });
  } catch (error) {
    console.error("syncToSupabase error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}