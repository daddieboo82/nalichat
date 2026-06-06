import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Escalating timeout durations (in minutes) based on number of prior violations.
const TIMEOUT_LADDER = [0, 60, 360, 1440, 4320]; // warning, 1h, 6h, 24h, 72h

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, conversation_id, message_id } = await req.json();
    if (!text || !text.trim()) {
      return Response.json({ flagged: false });
    }

    // Classify the content with the AI moderator.
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a strict content moderation system for a music collaboration platform. Analyze the following user message and determine if it violates community policy.

Flag ONLY genuine violations in these categories:
- violence: threats of physical harm, graphic violence, incitement to violence
- racism: racial slurs, hateful content targeting race/ethnicity/religion
- sexual_violence: rape, sexual assault, non-consensual sexual content, child exploitation
- bullying: targeted harassment, severe insults, demeaning attacks on a person
- illegal_activity: solicitation of illegal drugs/weapons, human trafficking, instructions for serious crimes

Do NOT flag: normal disagreements, profanity used casually, song lyrics discussion that isn't a real threat, jokes that aren't hateful.

Message to analyze: "${text}"`,
      response_json_schema: {
        type: "object",
        properties: {
          flagged: { type: "boolean" },
          category: {
            type: "string",
            enum: ["violence", "racism", "sexual_violence", "bullying", "illegal_activity", "none"]
          },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          explanation: { type: "string" }
        },
        required: ["flagged"]
      }
    });

    if (!result?.flagged || result.category === "none") {
      return Response.json({ flagged: false });
    }

    // Record the violation and escalate enforcement.
    const priorCount = user.violation_count || 0;
    const newCount = priorCount + 1;

    // High-severity sexual_violence (e.g. child exploitation) -> immediate ban.
    const immediateBan = result.category === "sexual_violence" && result.severity === "high";

    let action_taken = "warning";
    let timeout_until = null;
    let is_banned = user.is_banned || false;

    if (immediateBan || newCount >= 5) {
      action_taken = "ban";
      is_banned = true;
    } else if (newCount >= 2) {
      const minutes = TIMEOUT_LADDER[Math.min(newCount, TIMEOUT_LADDER.length - 1)] || 60;
      action_taken = "timeout";
      timeout_until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    }

    await base44.asServiceRole.entities.Violation.create({
      user_id: user.id,
      user_name: user.display_name || user.full_name,
      category: result.category,
      severity: result.severity || "medium",
      content: text.slice(0, 1000),
      conversation_id: conversation_id || null,
      message_id: message_id || null,
      action_taken,
      explanation: result.explanation || ""
    });

    await base44.asServiceRole.entities.User.update(user.id, {
      violation_count: newCount,
      ...(timeout_until ? { timeout_until } : {}),
      ...(is_banned ? { is_banned: true } : {})
    });

    // If a message was already created, remove it.
    if (message_id) {
      try { await base44.asServiceRole.entities.Message.delete(message_id); } catch (e) {}
    }

    return Response.json({
      flagged: true,
      category: result.category,
      severity: result.severity,
      action_taken,
      timeout_until,
      is_banned,
      explanation: result.explanation || "",
      violation_count: newCount
    });
  } catch (error) {
    console.error("moderateContent error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});