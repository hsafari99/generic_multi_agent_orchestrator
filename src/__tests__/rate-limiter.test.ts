import { RateLimiter } from '../core/security/rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter({
      tokensPerInterval: 10,
      interval: 1000,
      maxTokens: 20,
    });
  });

  describe('acquireToken', () => {
    it('should allow token acquisition when tokens are available', async () => {
      const result = await rateLimiter.acquireToken();
      expect(result).toBe(true);
      expect(rateLimiter.getRemainingTokens()).toBe(19);
    });

    it('should not allow token acquisition when no tokens are available', async () => {
      // Use all tokens
      for (let i = 0; i < 20; i++) {
        await rateLimiter.acquireToken();
      }

      const result = await rateLimiter.acquireToken();
      expect(result).toBe(false);
      expect(rateLimiter.getRemainingTokens()).toBe(0);
    });

    it('should refill tokens after interval', async () => {
      // Use all tokens
      for (let i = 0; i < 20; i++) {
        await rateLimiter.acquireToken();
      }

      // Wait for interval plus a small buffer
      await new Promise(resolve => setTimeout(resolve, 1100));

      const result = await rateLimiter.acquireToken();
      expect(result).toBe(true);
      // Allow for small timing variations
      expect(rateLimiter.getRemainingTokens()).toBeGreaterThanOrEqual(9);
      expect(rateLimiter.getRemainingTokens()).toBeLessThanOrEqual(10);
    });
  });

  describe('getTimeUntilNextToken', () => {
    it('should return 0 when tokens are available', () => {
      expect(rateLimiter.getTimeUntilNextToken()).toBe(0);
    });

    it('should return time until next token when no tokens are available', async () => {
      // Use all tokens
      for (let i = 0; i < 20; i++) {
        await rateLimiter.acquireToken();
      }

      const timeUntilNext = rateLimiter.getTimeUntilNextToken();
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(1000);
    });
  });
});
