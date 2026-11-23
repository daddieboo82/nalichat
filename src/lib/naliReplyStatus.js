// Only a newly arrived assistant reply can settle the current pending send.
// Older assistant messages can remain last while the SDK reconnects or
// returns cached history, so checking the last role alone is insufficient.
export function countAssistantReplies(messages) {
  return Array.isArray(messages)
    ? messages.filter((message) => message?.role === 'assistant').length
    : 0;
}

// Reconnect/poll responses can finish after newer realtime snapshots.
// Preserve newer conversation history rather than replacing it with an older
// partial result. Equal-length snapshots are accepted so streaming edits work.
export function preferCurrentConversationMessages(current, incoming) {
  if (!Array.isArray(incoming)) return Array.isArray(current) ? current : [];
  if (!Array.isArray(current)) return incoming;
  if (incoming.length < current.length) return current;
  if (incoming.length === current.length && countAssistantReplies(incoming) < countAssistantReplies(current)) return current;
  return incoming;
}

export function hasReplySince(messages, assistantReplyBaseline) {
  return Number.isInteger(assistantReplyBaseline)
    && assistantReplyBaseline >= 0
    && countAssistantReplies(messages) > assistantReplyBaseline;
}
