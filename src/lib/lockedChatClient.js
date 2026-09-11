import { base44 } from "@/api/base44Client";
import {
  createLockedChatSalt,
  deriveLockedChatPinVerifier,
  LOCKED_CHAT_PBKDF2_ITERATIONS,
} from "@/lib/lockedChatCrypto";

async function invokeLockedChatVault(action, payload = {}) {
  try {
    const response = await base44.functions.invoke("lockedChatVault", { action, ...payload });
    const data = response?.data;
    if (data && !data.error) return data;
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

export function getLockedChatState() {
  return invokeLockedChatVault("state");
}

export async function configureLockedChatPin(pin) {
  const salt = createLockedChatSalt();
  const verifier = await deriveLockedChatPinVerifier(pin, {
    salt,
    iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
  });
  return invokeLockedChatVault("set_pin", {
    salt,
    verifier,
    iterations: LOCKED_CHAT_PBKDF2_ITERATIONS,
  });
}

export async function verifyLockedChatPin(pin, security) {
  const verifier = await deriveLockedChatPinVerifier(pin, security);
  return invokeLockedChatVault("verify_pin", { verifier });
}

export function setLockedConversation(conversationId, locked) {
  return invokeLockedChatVault("set_locked", {
    conversationId,
    locked: locked === true,
  });
}

export function requestLockedChatPinReset() {
  return invokeLockedChatVault("request_reset");
}

export async function completeLockedChatPinReset(code, pin) {
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
  });
}
