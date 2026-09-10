export const MESSAGE_ENTRANCE_FLAG = "_animateOnInsert";

export function getMessageIdentity(message) {
  return message?.client_message_key || message?.id || null;
}

export function createMessageAnimationState() {
  return {
    conversationId: null,
    hydrated: false,
    seen: new Set(),
  };
}

export function resolveMessageAnimations(
  previousState,
  { conversationId, messages = [], isLoading = false, reduceMotion = false }
) {
  const identities = messages
    .map(getMessageIdentity)
    .filter(Boolean);
  const conversationChanged = previousState.conversationId !== conversationId;
  const hydrating = conversationChanged || !previousState.hydrated;

  if (hydrating) {
    return {
      state: {
        conversationId,
        hydrated: !isLoading,
        seen: new Set(identities),
      },
      animated: new Set(),
    };
  }

  const animated = new Set();
  for (const message of messages) {
    const identity = getMessageIdentity(message);
    if (
      identity &&
      !reduceMotion &&
      message[MESSAGE_ENTRANCE_FLAG] &&
      !previousState.seen.has(identity)
    ) {
      animated.add(identity);
    }
  }

  return {
    state: {
      conversationId,
      hydrated: true,
      seen: new Set(identities),
    },
    animated,
  };
}
