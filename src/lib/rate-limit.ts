// Simple in-memory rate limiter
// In production, use Redis for distributed rate limiting

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

export function rateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;

  let entry = rateLimitStore.get(key);

  // If no entry or window expired, create new entry
  if (!entry || entry.resetTime < now) {
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime,
    };
  }

  // Increment count
  entry.count++;

  // Check if over limit
  if (entry.count > config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
    };
  }

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
  };
}

// Pre-configured rate limiters
export const authRateLimit = (ip: string) => rateLimit(`auth:${ip}`, {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per 15 minutes
});

export const forgotPasswordRateLimit = (ip: string) => rateLimit(`forgot:${ip}`, {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3, // 3 reset requests per hour
});

export const apiRateLimit = (ip: string) => rateLimit(`api:${ip}`, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});

export const strictRateLimit = (ip: string) => rateLimit(`strict:${ip}`, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute (for sensitive operations)
});

export const mfaRateLimit = (userId: string) => rateLimit(`mfa:${userId}`, {
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 5, // 5 MFA attempts per 5 minutes
});

export const transferRateLimit = (userId: string) => rateLimit(`transfer:${userId}`, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 transfers per minute
});

export const uploadRateLimit = (userId: string) => rateLimit(`upload:${userId}`, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 uploads per minute
});

export const webhookRateLimit = (businessId: string) => rateLimit(`webhook:${businessId}`, {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 webhook deliveries per minute
});
