import { readJsonBodyLimited, requestBodyErrorResponse } from '../../shared/requestLimits.ts';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { consumeHourlyLimit } from '../../shared/rateLimit.ts';
import { isBase44EntityId } from '../../shared/workflowEvents.ts';

const GOAL_MESSAGES = 20;
const GOAL_TASKS = 3;
const CREDITS_REWARD = 100;

function pad(n: number) { return String(n).padStart(2, '0'); }
function weekKey(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function weekendWindow(key: string) {
  const monday = new Date(`${key}T00:00:00`);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { starts_at: saturday.toISOString(), expires_at: sunday.toISOString() };
}

function goalMet(progress: any, member: 'a' | 'b') {
  return (progress[`member_${member}_messages`] || 0) >= GOAL_MESSAGES ||
    (progress[`member_${member}_tasks`] || 0) >= GOAL_TASKS;
}

function happenedThisWeek(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  return weekKey(date) === weekKey();
}

async function activeSquad(entities: any, userId: string) {
  const [asA, asB] = await Promise.all([
    entities.Squad.filter({ member_a_id: userId, status: 'active' }, '-created_date', 1),
    entities.Squad.filter({ member_b_id: userId, status: 'active' }, '-created_date', 1),
  ]);
  return asA[0] || asB[0] || null;
}

async function getOrCreateProgress(entities: any, squad: any) {
  const key = weekKey();
  const id = `squad_progress_${squad.id}_${key}`;
  try {
    const existing = await entities.SquadProgress.get(id);
    if (existing) return existing;
  } catch {}

  try {
    return await entities.SquadProgress.create({
      id,
      squad_id: squad.id,
      member_a_id: squad.member_a_id,
      member_b_id: squad.member_b_id,
      week_key: key,
    });
  } catch {
    return await entities.SquadProgress.get(id);
  }
}

async function awardOnce(entities: any, userId: string, squad: any, progress: any) {
  const rewardId = `squad_reward_${progress.id}_${userId}`;
  try {
    await entities.SquadReward.create({
      id: rewardId,
      squad_id: squad.id,
      progress_id: progress.id,
      user_id: userId,
      credits: CREDITS_REWARD,
      week_key: progress.week_key,
    });
  } catch (createError) {
    const existing = await entities.SquadReward.get(rewardId).catch(() => null);
    if (existing?.user_id === userId && existing?.progress_id === progress.id) {
      return false;
    }
    throw createError;
  }
  try {
    const creditUpdate = await entities.User.updateMany(
      { id: userId },
      { $inc: { squad_credits: CREDITS_REWARD } },
    );
    if (Number(creditUpdate?.updated || 0) !== 1) {
      throw new Error('Squad credit update did not modify exactly one account');
    }
  } catch (creditError) {
    // Keep the reward retryable if the protected user-credit update fails.
    try {
      await entities.SquadReward.delete(rewardId);
    } catch (rollbackError) {
      console.error('Squad reward rollback failed:', rollbackError);
      throw new Error(
        'Squad reward credit update failed and rollback was incomplete. Please retry.',
        { cause: creditError },
      );
    }
    throw creditError;
  }
  return true;
}

async function validateSource(entities: any, user: any, sourceType: string, sourceId: string) {
  if (sourceType === 'message') {
    const message = await entities.Message.get(sourceId).catch(() => null);
    if (!message || message.sender_id !== user.id || message.type === 'session') return false;
    return happenedThisWeek(message.created_date);
  }

  if (sourceType === 'art_post') {
    const post = await entities.ArtPost.get(sourceId).catch(() => null);
    return Boolean(
      post
      && post.creator_id === user.id
      && happenedThisWeek(post.created_date)
    );
  }

  if (sourceType === 'milestone') {
    const milestone = await entities.Milestone.get(sourceId).catch(() => null);
    if (!milestone || !milestone.completed || milestone.completed_by_id !== user.id) return false;
    return happenedThisWeek(milestone.completed_at);
  }

  return false;
}

async function activityId(userId: string, sourceType: string, sourceId: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${userId}:${sourceType}:${sourceId}`),
  );
  return 'squad_activity_' + Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.is_banned) {
      return Response.json({ error: 'banned' }, { status: 403 });
    }
    if (user.timeout_until && new Date(user.timeout_until).getTime() > Date.now()) {
      return Response.json({ error: 'timed_out', timeout_until: user.timeout_until }, { status: 403 });
    }

    const activityRate = await consumeHourlyLimit(
      base44.asServiceRole.entities,
      user.id,
      'squad_activity',
      600,
    );
    if (!activityRate.allowed) {
      return Response.json({ error: 'Squad activity rate limit exceeded. Please try again later.' }, { status: 429 });
    }

    const { sourceType, sourceId } = await readJsonBodyLimited(req, 8 * 1024);
    const normalizedSourceId = typeof sourceId === 'string' ? sourceId.trim() : '';
    if (!['message', 'art_post', 'milestone'].includes(sourceType) || !isBase44EntityId(normalizedSourceId)) {
      return Response.json({ error: 'Valid sourceType and sourceId are required' }, { status: 400 });
    }

    const entities = base44.asServiceRole.entities;
    if (!(await validateSource(entities, user, sourceType, normalizedSourceId))) {
      return Response.json({ error: 'Activity source is not valid for this user' }, { status: 403 });
    }

    const squad = await activeSquad(entities, user.id);
    if (!squad) return Response.json({ success: true, action: 'record_squad_activity', userId: user.id, sourceType, sourceId: normalizedSourceId, tracked: false, duplicate: false });

    const progress = await getOrCreateProgress(entities, squad);
    const ledgerId = await activityId(user.id, sourceType, String(sourceId));

    let duplicate = false;
    try {
      await entities.SquadActivity.create({
        id: ledgerId,
        user_id: user.id,
        squad_id: squad.id,
        week_key: progress.week_key,
        source_type: sourceType,
        source_id: String(sourceId),
      });
    } catch (createError) {
      const existing = await entities.SquadActivity.get(ledgerId).catch(() => null);
      if (
        existing?.user_id === user.id
        && existing?.source_type === sourceType
        && existing?.source_id === String(sourceId)
      ) {
        duplicate = true;
      } else {
        throw createError;
      }
    }

    const member = squad.member_a_id === user.id ? 'a' : 'b';
    const field = sourceType === 'message'
      ? `member_${member}_messages`
      : `member_${member}_tasks`;

    if (!duplicate) {
      try {
        const progressUpdate = await entities.SquadProgress.updateMany(
          { id: progress.id },
          { $inc: { [field]: 1 } },
        );
        if (Number(progressUpdate?.updated || 0) !== 1) {
          throw new Error('Squad progress update did not modify exactly one record');
        }
      } catch (progressError) {
        // Keep the activity retryable if its progress increment did not land.
        try {
          await entities.SquadActivity.delete(ledgerId);
        } catch (rollbackError) {
          console.error('Squad activity rollback failed:', rollbackError);
          throw new Error(
            'Squad progress update failed and activity rollback was incomplete. Please retry.',
            { cause: progressError },
          );
        }
        throw progressError;
      }
    }

    let updated = await entities.SquadProgress.get(progress.id);

    // Re-evaluate bonus state even for duplicate retries. This lets a retry
    // recover if the original request incremented progress but failed while
    // unlocking or awarding the weekly bonus.
    if (!updated.bonus_unlocked && goalMet(updated, 'a') && goalMet(updated, 'b')) {
      const window = weekendWindow(updated.week_key);
      await entities.SquadProgress.update(updated.id, {
        bonus_unlocked: true,
        bonus_starts_at: window.starts_at,
        bonus_expires_at: window.expires_at,
      });
      updated = await entities.SquadProgress.get(updated.id);
    }

    if (updated.bonus_unlocked && goalMet(updated, 'a') && goalMet(updated, 'b')) {
      await Promise.all([
        awardOnce(entities, squad.member_a_id, squad, updated),
        awardOnce(entities, squad.member_b_id, squad, updated),
      ]);
    }

    return Response.json({
      success: true,
      action: 'record_squad_activity',
      userId: user.id,
      sourceType,
      sourceId: normalizedSourceId,
      tracked: !duplicate,
      duplicate,
      progress: updated,
    });
  } catch (error) {
    const bodyError = requestBodyErrorResponse(error);
    if (bodyError) return bodyError;
    console.error('recordSquadActivity error:', error);
    return Response.json({ error: 'Could not record squad activity' }, { status: 500 });
  }
});
