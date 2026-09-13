import { base44 } from "@/api/base44Client";
import {
  createLockedChatSalt,
  deriveLockedChatPinVerifier,
  LOCKED_CHAT_PBKDF2_ITERATIONS,
} from "@/lib/lockedChatCrypto";

async function invokeLockedChatVault(action, payload = {}, expectedUserId) {
  try {
    const response = await base44.functions.invoke("lockedChatVault", { action, ...payload });
    const data = response?.data;
    if (
      data &&
      !data.error &&
      data.success === true &&
      data.action === action &&
      (!expectedUserId || data.userId === expectedUserId)
    ) return data;
    throw Object.assign(
      new Error(data?.error || "Locked chats are unavailable."),
      {
        code: data?.code || "locked_chat_error",
        retryAfterMs: Number(data?.retryAfterMs) || 0,
        isLockedChatError: true,
      },
    );
  } catch (cause) {
    if (cause?.isLockedChatError) throw cause;
    const data = cause?.response?.data || cause?.data;
    const error = Object.assign(
      new Error(data?.error || cause?.message || "Locked chats are unavailable."),
      {
        code: data?.code || "locked_chat_error",
        retryAfterMs: Number(data?.retryAfterMs) || 0,
        isLockedChatError: true,
      },
    );
    throw error;
  }
}

export function getLockedChatState(userId) {
  return invokeLockedChatVault("state", {}, userId);
}

export async function configureLockedChatPin(pin, userId) {
  const salt = createLockedChatSalt();
  const verifier = await deriveLockedChatPinVerifier(pin, {
    salt,
    iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
  });
  return invokeLockedChatVault("set_pin", {
    salt,
    verifier,
    iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
  }, userId);
}

export async function verifyLockedChatPin(pin, security, userId) {
  const verifier = await deriveLockedChatPinVerifier(pin, security);
  return invokeLockedChatVault("verify_pin", { verifier }, userId);
}

export function setLockedConversation(conversationId, locked, userId) {
  return invokeLockedChatVault("set_locked", {
    conversationId,
    locked: locked === true,
  }, userId);
}

export function requestLockedChatPinReset(userId) {
  return invokeLockedChatVault("request_reset", {}, userId);
}

export async function completeLockedChatPinReset(code, pin, userId) {
  const salt = createLockedChatSalt();
  const verifier = await deriveLockedChatPinVerifier(pin, {
    salt,
    iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
  });
  return invokeLockedChatVault("complete_reset", {
    code,
    salt,
    verifier,
    iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
  }, userId);
}
