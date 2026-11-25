/**
 * مساعدات أمان الجلسة والحد من محاولات الدخول الفاشلة (Rate Limiting & Session Timeout)
 */

export interface RateLimitEntry {
  count: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 دقيقة
const LOCK_DURATION_MS = 15 * 60 * 1000;

export class LoginRateLimiter {
  private store = new Map<string, RateLimitEntry>();

  private key(email: string, ip: string): string {
    return `${email.trim().toLowerCase()}::${ip.trim() || 'unknown'}`;
  }

  check(email: string, ip: string, now = Date.now()): { allowed: boolean; remainingSeconds: number } {
    const k = this.key(email, ip);
    const entry = this.store.get(k);
    if (!entry) return { allowed: true, remainingSeconds: 0 };

    if (entry.lockedUntil && entry.lockedUntil > now) {
      return {
        allowed: false,
        remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
      };
    }

    if (now - entry.firstAttemptAt > WINDOW_MS) {
      this.store.delete(k);
      return { allowed: true, remainingSeconds: 0 };
    }

    return { allowed: true, remainingSeconds: 0 };
  }

  recordFailure(email: string, ip: string, now = Date.now()): {
    attempts: number;
    locked: boolean;
    remainingSeconds: number;
  } {
    const k = this.key(email, ip);
    const existing = this.store.get(k);

    if (!existing || now - existing.firstAttemptAt > WINDOW_MS) {
      this.store.set(k, {
        count: 1,
        firstAttemptAt: now,
        lockedUntil: null,
      });
      return { attempts: 1, locked: false, remainingSeconds: 0 };
    }

    const nextCount = existing.count + 1;
    const lockedUntil = nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCK_DURATION_MS : null;
    this.store.set(k, {
      count: nextCount,
      firstAttemptAt: existing.firstAttemptAt,
      lockedUntil,
    });

    return {
      attempts: nextCount,
      locked: Boolean(lockedUntil),
      remainingSeconds: lockedUntil ? Math.ceil(LOCK_DURATION_MS / 1000) : 0,
    };
  }

  clear(email: string, ip: string): void {
    this.store.delete(this.key(email, ip));
  }
}

export const globalLoginRateLimiter = new LoginRateLimiter();

export function isSessionTimedOut(
  lastActivityMs: number,
  timeoutMinutes: number,
  nowMs = Date.now()
): boolean {
  const safeMinutes = Math.max(5, Number(timeoutMinutes) || 120);
  return nowMs - lastActivityMs > safeMinutes * 60 * 1000;
}
