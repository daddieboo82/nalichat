import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { resolveUserSubscription } from '../../shared/subscriptionAccess.ts';
import {
  constantTimeEqual,
  canConfigureLockedConversation,
  countActiveVerificationAttempts,
  failedPinAttempt,
  hashResetCode,
  isConversationMember,
  isNotFoundError,
  isResetChallengeUsable,
  LOCKED_CHAT_KDF,
  LOCKED_CHAT_MAX_RESET_ATTEMPTS,
  LOCKED_CHAT_RESET_TTL_MS,
  remainingLockoutMs,
  validPinConfiguration,
} from '../../shared/lockedChats.ts';

const PAGE_SIZE = 500;
const verificationQueues = new Map<string, Promise<void>>();

function errorResponse(error: string, status: number, code?: string, retryAfterMs?: number) {
  return Response.json({ error, code, retryAfterMs }, { status });
}

async function serializeVerification<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = verificationQueues.get(key) || Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  verificationQueues.set(key, tail);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (verificationQueues.get(key) === tail) verificationQueues.delete(key);
  }
}

async function listPreferences(base44: any, userId: string) {
  const preferences: any[] = [];
  for (let skip = 0; ; skip += PAGE_SIZE) {
    const page = await base44.asServiceRole.entities.LockedConversationPreference.filter(
      { user_id: userId },
      '-locked_at',
      PAGE_SIZE,
      skip,
    );
    preferences.push(...page);
    if (page.length < PAGE_SIZE) return preferences;
  }
}

async function listAccessibleLockedIds(base44: any, userId: string) {
  const preferences = await listPreferences(base44, userId);
  const ids: string[] = [];
  for (const preference of preferences) {
    let conversation;
    try {
      conversation = await base44.asServiceRole.entities.Conversation.get(preference.conversation_id);
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      await base44.asServiceRole.entities.LockedConversationPreference.delete(preference.id);
      continue;
    }
    if (isConversationMember(conversation, userId)) {
      ids.push(preference.conversation_id);
    } else {
      await base44.asServiceRole.entities.LockedConversationPreference.delete(preference.id);
    }
  }
  return [...new Set(ids)];
}

async function getSecurity(base44: any, userId: string) {
  const records = await base44.asServiceRole.entities.LockedChatSecurity.filter(
    { user_id: userId },
    '-created_date',
    2,
  );
  return records[0] || null;
}

async function reserveVerificationAttempt(
  base44: any,
  userId: string,
  kind: 'pin' | 'reset',
  challengeId?: string,
) {
  const attemptedAt = new Date().toISOString();
  const attempt = await base44.asServiceRole.entities.LockedChatVerificationAttempt.create({
    user_id: userId,
    kind,
    challenge_id: challengeId || '',
    attempted_at: attemptedAt,
    status: 'pending',
  });
  const records = await base44.asServiceRole.entities.LockedChatVerificationAttempt.filter(
    challengeId ? { user_id: userId, kind, challenge_id: challengeId } : { user_id: userId, kind },
    '-attempted_at',
    100,
  );
  return {
    attempt,
    activeAttempts: countActiveVerificationAttempts(records),
  };
}

function publicSecurity(security: any) {
  return security ? {
    configured: true,
    salt: security.salt,
    iterations: security.iterations,
    kdf: security.kdf,
  } : {
    configured: false,
    salt: null,
    iterations: null,
    kdf: null,
  };
}

async function requireEntitlement(base44: any, userId: string) {
  const access = await resolveUserSubscription(
    base44.asServiceRole.entities.Subscription,
    userId,
  );
  if (access.entitlements['privacy.locked_chats'] !== true) {
    throw Object.assign(new Error('Premium Plus is required to change locked chats.'), {
      status: 403,
      code: 'locked_chats_not_entitled',
    });
  }
  return access;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return errorResponse('Unauthorized', 401, 'unauthorized');

    const body = await req.json();
    const action = body?.action;

    if (action === 'state') {
      const [lockedConversationIds, security] = await Promise.all([
        listAccessibleLockedIds(base44, user.id),
        getSecurity(base44, user.id),
      ]);
      return Response.json({
        lockedConversationIds,
        security: publicSecurity(security),
      });
    }

    if (action === 'set_pin') {
      await requireEntitlement(base44, user.id);
      if (!validPinConfiguration(body)) {
        return errorResponse('Invalid PIN configuration.', 400, 'invalid_pin_configuration');
      }
      if (await getSecurity(base44, user.id)) {
        return errorResponse(
          'A PIN is already configured. Use account-verified PIN reset.',
          409,
          'pin_already_configured',
        );
      }
      const security = await base44.asServiceRole.entities.LockedChatSecurity.create({
        user_id: user.id,
        kdf: LOCKED_CHAT_KDF,
        salt: body.salt,
        pin_verifier: body.verifier,
        iterations: body.iterations,
        failed_attempts: 0,
      });
      return Response.json({ security: publicSecurity(security) });
    }

    if (action === 'verify_pin') {
      return serializeVerification(`pin:${user.id}`, async () => {
        const security = await getSecurity(base44, user.id);
        if (!security) return errorResponse('No locked-chat PIN is configured.', 409, 'pin_not_configured');

        const retryAfterMs = remainingLockoutMs(security.locked_until);
        if (retryAfterMs > 0) {
          return errorResponse('Too many failed attempts.', 429, 'pin_locked_out', retryAfterMs);
        }
        const reservation = await reserveVerificationAttempt(base44, user.id, 'pin');
        if (reservation.activeAttempts > 5) {
          const attempt = failedPinAttempt(reservation.activeAttempts - 1);
          await Promise.all([
            base44.asServiceRole.entities.LockedChatVerificationAttempt.update(
              reservation.attempt.id,
              { status: 'throttled' },
            ),
            base44.asServiceRole.entities.LockedChatSecurity.update(security.id, {
              failed_attempts: attempt.failedAttempts,
              locked_until: attempt.lockedUntil,
            }),
          ]);
          return errorResponse('Too many failed attempts.', 429, 'pin_locked_out', attempt.retryAfterMs);
        }

        const candidate = typeof body.verifier === 'string' ? body.verifier : '';
        if (!constantTimeEqual(candidate, security.pin_verifier || '')) {
          const attempt = failedPinAttempt(Math.max(
            Number(security.failed_attempts) || 0,
            reservation.activeAttempts - 1,
          ));
          await Promise.all([
            base44.asServiceRole.entities.LockedChatVerificationAttempt.update(
              reservation.attempt.id,
              { status: 'failed' },
            ),
            base44.asServiceRole.entities.LockedChatSecurity.update(security.id, {
              failed_attempts: attempt.failedAttempts,
              locked_until: attempt.lockedUntil,
            }),
          ]);
          return errorResponse('Incorrect PIN.', 401, 'incorrect_pin', attempt.retryAfterMs);
        }

        await Promise.all([
          base44.asServiceRole.entities.LockedChatVerificationAttempt.update(
            reservation.attempt.id,
            { status: 'succeeded' },
          ),
          base44.asServiceRole.entities.LockedChatSecurity.update(security.id, {
            failed_attempts: 0,
            locked_until: null,
            verified_at: new Date().toISOString(),
          }),
        ]);
        return Response.json({ unlocked: true });
      });
    }

    if (action === 'set_locked') {
      const access = await requireEntitlement(base44, user.id);
      const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
      if (!conversationId) {
        return errorResponse('conversationId is required.', 400, 'conversation_required');
      }
      const conversation = await base44.asServiceRole.entities.Conversation.get(conversationId);
      if (!canConfigureLockedConversation(
        conversation,
        user.id,
        access.entitlements['privacy.locked_chats'] === true,
      )) {
        return errorResponse('Conversation not found.', 404, 'conversation_not_found');
      }
      const existing = await base44.asServiceRole.entities.LockedConversationPreference.filter(
        { user_id: user.id, conversation_id: conversationId },
        '-created_date',
        20,
      );
      if (body.locked === true) {
        if (!await getSecurity(base44, user.id)) {
          return errorResponse('Set up a PIN before locking a chat.', 409, 'pin_not_configured');
        }
        if (existing.length === 0) {
          await base44.asServiceRole.entities.LockedConversationPreference.create({
            user_id: user.id,
            conversation_id: conversationId,
            locked_at: new Date().toISOString(),
          });
        }
      } else {
        await Promise.all(existing.map((preference: any) =>
          base44.asServiceRole.entities.LockedConversationPreference.delete(preference.id)
        ));
      }
      return Response.json({
        lockedConversationIds: await listAccessibleLockedIds(base44, user.id),
      });
    }

    if (action === 'request_reset') {
      const security = await getSecurity(base44, user.id);
      if (!security) return errorResponse('No locked-chat PIN is configured.', 409, 'pin_not_configured');
      if (!user.email) return errorResponse('Your account has no verified email.', 409, 'email_unavailable');

      const recent = await base44.asServiceRole.entities.LockedChatResetChallenge.filter(
        { user_id: user.id },
        '-created_date',
        1,
      );
      if (recent[0] && Date.now() - Date.parse(recent[0].created_date) < 60_000) {
        return errorResponse('Wait before requesting another code.', 429, 'reset_throttled', 60_000);
      }

      const random = new Uint32Array(1);
      crypto.getRandomValues(random);
      const code = String(random[0] % 1_000_000).padStart(6, '0');
      const challenge = await base44.asServiceRole.entities.LockedChatResetChallenge.create({
        user_id: user.id,
        code_hash: await hashResetCode(user.id, code),
        expires_at: new Date(Date.now() + LOCKED_CHAT_RESET_TTL_MS).toISOString(),
        attempt_count: 0,
      });
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: 'Your NaliChat locked-chat PIN reset code',
          body: `Your verification code is ${code}. It expires in 10 minutes. This changes only the NaliChat app lock; it does not change your account password or message encryption.`,
        });
      } catch {
        await base44.asServiceRole.entities.LockedChatResetChallenge.delete(challenge.id);
        return errorResponse('The verification email could not be sent.', 503, 'reset_email_failed');
      }
      return Response.json({ sent: true });
    }

    if (action === 'complete_reset') {
      if (!validPinConfiguration(body) || !/^\d{6}$/.test(body.code || '')) {
        return errorResponse('Invalid reset request.', 400, 'invalid_reset');
      }
      return serializeVerification(`reset:${user.id}`, async () => {
        const challenges = await base44.asServiceRole.entities.LockedChatResetChallenge.filter(
          { user_id: user.id },
          '-created_date',
          10,
        );
        const challenge = challenges.find((candidate: any) => isResetChallengeUsable(candidate));
        if (!challenge) {
          return errorResponse('Verification code is expired or unavailable.', 410, 'reset_expired');
        }
        const reservation = await reserveVerificationAttempt(
          base44,
          user.id,
          'reset',
          challenge.id,
        );
        if (reservation.activeAttempts > LOCKED_CHAT_MAX_RESET_ATTEMPTS) {
          await base44.asServiceRole.entities.LockedChatVerificationAttempt.update(
            reservation.attempt.id,
            { status: 'throttled' },
          );
          return errorResponse('Verification code is expired or unavailable.', 410, 'reset_expired');
        }
        const providedHash = await hashResetCode(user.id, body.code);
        if (!constantTimeEqual(providedHash, challenge.code_hash || '')) {
          await Promise.all([
            base44.asServiceRole.entities.LockedChatVerificationAttempt.update(
              reservation.attempt.id,
              { status: 'failed' },
            ),
            base44.asServiceRole.entities.LockedChatResetChallenge.update(challenge.id, {
              attempt_count: Math.max(
                Number(challenge.attempt_count) + 1,
                reservation.activeAttempts,
              ),
            }),
          ]);
          return errorResponse('Incorrect verification code.', 401, 'incorrect_reset_code');
        }

        const security = await getSecurity(base44, user.id);
        const securityData = {
          user_id: user.id,
          kdf: LOCKED_CHAT_KDF,
          salt: body.salt,
          pin_verifier: body.verifier,
          iterations: body.iterations,
          failed_attempts: 0,
          locked_until: null,
          verified_at: new Date().toISOString(),
        };
        const updated = security
          ? await base44.asServiceRole.entities.LockedChatSecurity.update(security.id, securityData)
          : await base44.asServiceRole.entities.LockedChatSecurity.create(securityData);
        await Promise.all([
          base44.asServiceRole.entities.LockedChatVerificationAttempt.update(
            reservation.attempt.id,
            { status: 'succeeded' },
          ),
          ...challenges.map((candidate: any) =>
            base44.asServiceRole.entities.LockedChatResetChallenge.update(candidate.id, {
              consumed_at: new Date().toISOString(),
            })
          ),
        ]);
        return Response.json({ security: publicSecurity(updated), reset: true });
      });
    }

    return errorResponse('Unknown locked-chat action.', 400, 'unknown_action');
  } catch (error) {
    const status = Number((error as { status?: number })?.status) || 500;
    const code = (error as { code?: string })?.code;
    const message = error instanceof Error ? error.message : 'Locked chat request failed.';
    if (status >= 500) console.error('lockedChatVault error:', message);
    return errorResponse(message, status, code);
  }
});
