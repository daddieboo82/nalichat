export const LOCKED_CHAT_PIN_MIN_LENGTH = 6;
export const LOCKED_CHAT_PIN_MAX_LENGTH = 12;
export const LOCKED_CHAT_PBKDF2_ITERATIONS = 600_000;

function requireCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error("Secure PIN setup is not supported in this browser.");
  }
  return globalThis.crypto;
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function validateLockedChatPin(pin) {
  return new RegExp(`^\\d{${LOCKED_CHAT_PIN_MIN_LENGTH},${LOCKED_CHAT_PIN_MAX_LENGTH}}$`).test(pin);
}

export function createLockedChatSalt() {
  const salt = new Uint8Array(16);
  requireCrypto().getRandomValues(salt);
  return bytesToBase64(salt);
}

export async function deriveLockedChatPinVerifier(
  pin,
  {
    salt,
    iterations = LOCKED_CHAT_PBKDF2_ITERATIONS,
  },
) {
  if (!validateLockedChatPin(pin)) {
    throw new Error(`Use a ${LOCKED_CHAT_PIN_MIN_LENGTH}-${LOCKED_CHAT_PIN_MAX_LENGTH} digit PIN.`);
  }
  if (!salt || iterations < LOCKED_CHAT_PBKDF2_ITERATIONS) {
    throw new Error("The locked-chat PIN configuration is invalid.");
  }

  const cryptoApi = requireCrypto();
  const key = await cryptoApi.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await cryptoApi.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64ToBytes(salt),
      iterations,
    },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits));
}
