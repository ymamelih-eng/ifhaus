// Remembers recently seen message IDs so Meta's webhook retries are processed once.
export function createDedup({ ttlMs = 24 * 60 * 60 * 1000, maxSize = 10_000 } = {}) {
  const seen = new Map();
  return {
    /** Returns true the first time an id is seen, false for repeats. */
    firstSeen(id, now = Date.now()) {
      for (const [key, ts] of seen) {
        if (now - ts < ttlMs && seen.size < maxSize) break;
        seen.delete(key); // Map keeps insertion order: oldest entries first.
      }
      if (seen.has(id)) return false;
      seen.set(id, now);
      return true;
    }
  };
}
