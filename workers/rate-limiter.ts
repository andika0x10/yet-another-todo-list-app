import { DurableObject } from "cloudflare:workers";

export interface RateResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * One instance per key (for example "ip:1.2.3.4", "global", "sid:abc").
 * Uses a sliding window: only attempts within the most recent window count.
 * Counting happens inside a single Durable Object, so simultaneous requests are
 * still processed one at a time and cannot exceed the limit.
 */
export class RateLimiter extends DurableObject<Env> {
  /** Records one attempt. If the limit is reached, the attempt is rejected and not recorded. */
  async take(limit: number, windowMs: number): Promise<RateResult> {
    const now = Date.now();
    const stamps = await this.load(windowMs, now);

    if (stamps.length >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: stamps[stamps.length - limit] + windowMs - now,
      };
    }

    stamps.push(now);
    await this.ctx.storage.put("stamps", stamps);
    await this.ctx.storage.setAlarm(now + windowMs + 1000);

    const remaining = limit - stamps.length;
    return {
      allowed: true,
      remaining,
      retryAfterMs: remaining === 0 ? stamps[stamps.length - limit] + windowMs - now : 0,
    };
  }

  /** Undoes the latest attempt, used when the attempt turns out to be legitimate. */
  async refund(): Promise<void> {
    const stamps = (await this.ctx.storage.get<number[]>("stamps")) ?? [];
    stamps.pop();
    if (stamps.length === 0) {
      await this.reset();
    } else {
      await this.ctx.storage.put("stamps", stamps);
    }
  }

  async reset(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  /** Cleans up storage once every attempt has expired. */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
  }

  private async load(windowMs: number, now: number): Promise<number[]> {
    const stored = (await this.ctx.storage.get<number[]>("stamps")) ?? [];
    return stored.filter((t) => t > now - windowMs);
  }
}
