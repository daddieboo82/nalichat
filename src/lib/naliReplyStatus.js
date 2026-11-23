// A blank assistant placeholder (or an explicitly in-progress response) is
// not a usable reply. Do not unlock Send until there is actual reply content.
export function isUsableAssistantReply(message) {
  if (message?.role !== 'assistant') return false;
  if (message.is_streaming === true || message.completed === false || message.status === 'streaming' || message.status === 'pending') return false;
  if (typeof message.content === 'string') return message.content.trim().length > 0;
  if (Array.isArray(message.content)) {
    return message.content.some(part => typeof part === 'string' ? part.trim().length > 0 : typeof part?.text === 'string' && part.text.trim().length > 0);
  }
  return false;
}

// Only a newly arrived, usable assistant reply can settle a pending send.
// Older assistant messages can remain last while the SDK reconnects.
export function countAssistantReplies(messages) {
  return Array.isArray(messages)
    ? messages.filter(isUsableAssistantReply).length
    : 0;
}

// Reconnect/poll responses can finish after newer realtime snapshots.
// Preserve newer conversation history rather than replacing it with an older
// partial result. Equal-length snapshots are accepted so streaming edits work.
export function preferCurrentConversationMessages(current, incoming) {
  if (!Array.isArray(incoming)) return Array.isArray(current) ? current : [];
  if (!Array.isArray(current)) return incoming;
  if (incoming.length < current.length) return current;
  if (incoming.length === current.length) {
    if (countAssistantReplies(incoming) < countAssistantReplies(current)) return current;
    // Equal-size snapshots may come from different points in time. If both
    // carry stable IDs, a different identity at the same position is not a
    // streaming edit; it is an incompatible history snapshot. Keep the live
    // version instead of silently swapping an already-visible reply.
    const sameIdentities = incoming.every((message, index) => {
      const previousId = current[index]?.id;
      const incomingId = message?.id;
      return !previousId || !incomingId || previousId === incomingId;
    });
    if (!sameIdentities) return current;
  }
  return incoming;
}

// Capture the history boundary when a new request is dispatched. Older
// placeholder messages may finish later; they must not settle this request.
export function captureReplyBaseline(messages) {
  return {
    assistantCount: countAssistantReplies(messages),
    messageCount: Array.isArray(messages) ? messages.length : 0,
  };
}

export function hasReplySince(messages, assistantReplyBaseline) {
  if (!Array.isArray(messages)) return false;
  if (assistantReplyBaseline && typeof assistantReplyBaseline === 'object') {
    const { assistantCount, messageCount } = assistantReplyBaseline;
    return Number.isInteger(assistantCount) && assistantCount >= 0
      && Number.isInteger(messageCount) && messageCount >= 0
      && countAssistantReplies(messages) > assistantCount
      && messages.slice(messageCount).some(isUsableAssistantReply);
  }
  // Numeric baselines are supported for older callers without a history
  // boundary; new sends should always use captureReplyBaseline instead.
  return Number.isInteger(assistantReplyBaseline)
    && assistantReplyBaseline >= 0
    && countAssistantReplies(messages) > assistantReplyBaseline;
}
