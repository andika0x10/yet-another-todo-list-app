import type { RateResult } from "../../workers/rate-limiter";

/** Failed PIN attempts per IP address. */
export const LOGIN_IP_LIMIT = 5;
export const LOGIN_IP_WINDOW_MS = 15 * 60 * 1000;
/** Failed PIN attempts across all IPs. Stops guessing that rotates IP addresses. */
export const LOGIN_GLOBAL_LIMIT = 100;
export const LOGIN_GLOBAL_WINDOW_MS = 60 * 60 * 1000;
/** Card changes per session. */
export const MUTATION_LIMIT = 120;
export const MUTATION_WINDOW_MS = 60 * 1000;

function limiter(env: Env, name: string) {
  return env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(name));
}

export type LoginGate =
  | { ok: true; remaining: number; retryAfterMs: number }
  | { ok: false; scope: "ip" | "global"; retryAfterMs: number };

/**
 * Reserves one PIN attempt before the PIN is checked. The attempt is recorded first
 * (and refunded if the PIN is correct), so parallel guesses cannot exceed the limit.
 */
export async function beginLoginAttempt(env: Env, ip: string): Promise<LoginGate> {
  const byIp = await limiter(env, `ip:${ip}`).take(LOGIN_IP_LIMIT, LOGIN_IP_WINDOW_MS);
  if (!byIp.allowed) return { ok: false, scope: "ip", retryAfterMs: byIp.retryAfterMs };

  const global = await limiter(env, "global").take(LOGIN_GLOBAL_LIMIT, LOGIN_GLOBAL_WINDOW_MS);
  if (!global.allowed) {
    await limiter(env, `ip:${ip}`).refund();
    return { ok: false, scope: "global", retryAfterMs: global.retryAfterMs };
  }

  return { ok: true, remaining: byIp.remaining, retryAfterMs: byIp.retryAfterMs };
}

/** Correct PIN: the IP counter is reset and the global attempt is refunded. */
export async function finishLoginSuccess(env: Env, ip: string): Promise<void> {
  await Promise.all([limiter(env, `ip:${ip}`).reset(), limiter(env, "global").refund()]);
}

export function limitMutations(env: Env, sid: string): Promise<RateResult> {
  return limiter(env, `sid:${sid}`).take(MUTATION_LIMIT, MUTATION_WINDOW_MS);
}

export function formatWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000));
  return seconds < 60 ? `${seconds} detik` : `${Math.ceil(seconds / 60)} menit`;
}
