import { describe, expect, it } from 'vitest';
import { InMemoryRateLimiter } from './in-memory-rate-limiter';

describe('InMemoryRateLimiter', () => {
  it('allows up to max hits in the window', () => {
    const lim = new InMemoryRateLimiter(3, 1000);
    const t0 = 1_000_000;
    expect(lim.tryConsume('a', t0)).toBe(true);
    expect(lim.tryConsume('a', t0 + 1)).toBe(true);
    expect(lim.tryConsume('a', t0 + 2)).toBe(true);
    expect(lim.tryConsume('a', t0 + 3)).toBe(false);
  });

  it('resets after the window slides', () => {
    const lim = new InMemoryRateLimiter(2, 100);
    expect(lim.tryConsume('b', 0)).toBe(true);
    expect(lim.tryConsume('b', 10)).toBe(true);
    expect(lim.tryConsume('b', 20)).toBe(false);
    expect(lim.tryConsume('b', 111)).toBe(true);
  });

  it('isolates keys', () => {
    const lim = new InMemoryRateLimiter(1, 1000);
    expect(lim.tryConsume('x', 0)).toBe(true);
    expect(lim.tryConsume('y', 0)).toBe(true);
    expect(lim.tryConsume('x', 1)).toBe(false);
  });

  it('count does not consume', () => {
    const lim = new InMemoryRateLimiter(5, 1000);
    lim.tryConsume('c', 0);
    expect(lim.count('c', 1)).toBe(1);
    expect(lim.tryConsume('c', 2)).toBe(true);
  });
});
