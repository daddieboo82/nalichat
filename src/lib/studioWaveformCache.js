// Session-local LRU for waveform detail. Never persist decoded audio.
export function createStudioWaveformCache(load, { maxBytes = 24 * 1024 * 1024, maxEntries = 2 } = {}) {
  const entries = new Map();
  let bytes = 0, pending = null, generation = 0;
  return {
    async get(url) {
      if (!url) return null;
      if (entries.has(url)) {
        const entry = entries.get(url);
        entries.delete(url);
        entries.set(url, entry);
        return entry.buffer;
      }
      if (pending) return pending.url === url ? pending.promise : null;
      const epoch = generation;
      const job = {url, promise: null};
      pending = job;
      job.promise = Promise.resolve().then(() => load(url)).then(buffer => {
        if (epoch !== generation || !buffer) return null;
        const size = buffer.length * buffer.numberOfChannels * 4;
        if (!Number.isSafeInteger(size) || size <= 0 || size > maxBytes || maxEntries < 1) return null;
        while (entries.size && (bytes + size > maxBytes || entries.size >= maxEntries)) {
          const key = entries.keys().next().value;
          bytes -= entries.get(key).size;
          entries.delete(key);
        }
        entries.set(url, {buffer, size});
        bytes += size;
        return buffer;
      }).catch(() => null).finally(() => { if (pending === job) pending = null; });
      return job.promise;
    },
    clear() {
      generation++;
      entries.clear();
      bytes = 0;
      // Keep the pending slot until decode settles to prevent concurrent large decodes.
    },
  };
}
