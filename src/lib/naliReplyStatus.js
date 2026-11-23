// Only a newly arrived assistant reply can settle the current pending send.
// Older assistant messages can remain last while the SDK reconnects or
// returns cached history, so checking the last role alone is insufficient.
export function countAssistantReplies(messages) {
  return Array.isArray(messages)
    ? messages.filter((message) => message?.role === 'assistant').length
    : 0;
}

export function hasReplySince(messages, assistantReplyBaseline) {
  return Number.isInteger(assistantReplyBaseline)
    && assistantReplyBaseline >= 0
    && countAssistantReplies(messages) > assistantReplyBaseline;
}
