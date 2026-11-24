// Bound a history-only conversation read. This must never retry an AI send.
// Promise.race attaches handlers to the original request so a late result
// cannot affect the caller after the timeout has already settled.
export async function withNaliHistoryTimeout(promise, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Conversation refresh timed out')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
