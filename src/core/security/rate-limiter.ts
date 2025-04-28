export interface RateLimitConfig {
  tokensPerInterval: number;
  interval: number;
  maxTokens: number;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.maxTokens;
    this.lastRefill = Date.now();
  }

  private refillTokens(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(
      (timePassed / this.config.interval) * this.config.tokensPerInterval
    );

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  async acquireToken(): Promise<boolean> {
    this.refillTokens();

    if (this.tokens > 0) {
      this.tokens--;
      return true;
    }

    return false;
  }

  getRemainingTokens(): number {
    this.refillTokens();
    return this.tokens;
  }

  getTimeUntilNextToken(): number {
    if (this.tokens > 0) return 0;

    const now = Date.now();
    const timeSinceLastRefill = now - this.lastRefill;
    const timeUntilNextToken = this.config.interval - (timeSinceLastRefill % this.config.interval);

    return timeUntilNextToken;
  }
}
