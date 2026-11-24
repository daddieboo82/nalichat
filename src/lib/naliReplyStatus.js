// A blank assistant placeholder (or an explicitly in-progress response) is
// not a usable reply. Do not unlock Send until there is actual reply content.
export function isUsableAssistantReply(message) {
  if (message?.role !== 'assistant') return false;
  // Providers may report unfinished replies using different progress states.
  // Never unlock another send on text that is still being generated.
  const status = String(message.status || '').toLowerCase();
  if (message.is_streaming === true || message.completed === false || ['streaming', 'pending', 'in_progress', 'generating', 'queued', 'processing', 'failed', 'error', 'cancelled', 'canceled'].includes(status)) return false;
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
  // A longer history read is not necessarily newer: it may contain extra
  // user/tool events while losing a completed answer already seen live.
  if (countAssistantReplies(incoming) < countAssistantReplies(current)) return current;
  // Do not replace the known conversation prefix with different stable IDs,
  // even if the incoming snapshot happens to contain more entries. Same-ID
  // edits remain valid so an assistant's streaming text can complete.
  const sameIdentities = current.every((message, index) => {
    const previousId = message?.id;
    const incomingId = incoming[index]?.id;
    return !previousId || !incomingId || previousId === incomingId;
  });
  if (!sameIdentities) return current;
  // Same-ID streaming updates can arrive out of order. A shorter prefix
  // of text we've already displayed is stale, even with the same length
  // conversation array or extra trailing events. Keep the newer text.
  const regressesStreamingText = current.some((message, index) => {
    const next = incoming[index];
    if (!message?.id || next?.id !== message.id || message.role !== 'assistant') return false;
    const previousText = message.content;
    const nextText = next.content;
    if (typeof previousText !== 'string' || typeof nextText !== 'string') return false;
    const nextStillStreaming = next.is_streaming === true || next.completed === false || ['streaming', 'pending', 'in_progress', 'generating', 'queued', 'processing'].includes(String(next.status || '').toLowerCase());
    return nextStillStreaming && previousText.length > nextText.length && previousText.startsWith(nextText);
  });
  if (regressesStreamingText) return current;
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
