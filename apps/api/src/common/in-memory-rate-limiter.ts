/**
 * Sliding-window style counter: at most `max` hits per `windowMs` per key.
 * In-memory only (single process).
 */
export class InMemoryRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true if the key is still within the limit after recording this hit. */
  tryConsume(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const prev = this.hits.get(key) ?? [];
    const recent = prev.filter((t) => t > cutoff);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Hits in the current window without consuming. */
  count(key: string, now = Date.now()): number {
    const cutoff = now - this.windowMs;
    const recent = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    this.hits.set(key, recent);
    return recent.length;
  }
}
