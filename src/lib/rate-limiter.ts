import { prisma } from "@/lib/prisma";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: Date;
  limit: number;
}

export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  // Get rate limit rule for this endpoint
  const rule = await prisma.rateLimitRule.findFirst({
    where: {
      endpoint: { in: [endpoint, "*"] },
      isActive: true,
    },
    orderBy: { endpoint: "desc" }, // Prefer specific rules over wildcards
  });

  if (!rule) {
    // No rate limit configured
    return {
      allowed: true,
      remaining: -1,
      reset: new Date(),
      limit: -1,
    };
  }

  const windowStart = new Date(
    Math.floor(Date.now() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000
  );

  // Get or create rate limit log
  const log = await prisma.rateLimitLog.upsert({
    where: {
      identifier_endpoint_windowStart: {
        identifier,
        endpoint: rule.endpoint,
        windowStart,
      },
    },
    create: {
      identifier,
      endpoint: rule.endpoint,
      windowStart,
      requestCount: 1,
    },
    update: {
      requestCount: { increment: 1 },
    },
  });

  const allowed = log.requestCount <= rule.maxRequests;
  const remaining = Math.max(0, rule.maxRequests - log.requestCount);
  const reset = new Date(windowStart.getTime() + rule.windowSeconds * 1000);

  // Update blocked status
  if (!allowed && !log.blocked) {
    await prisma.rateLimitLog.update({
      where: { id: log.id },
      data: { blocked: true },
    });
  }

  return {
    allowed,
    remaining,
    reset,
    limit: rule.maxRequests,
  };
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  if (result.limit === -1) {
    return {};
  }

  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toISOString(),
  };
}

// Create default rate limit rules
export async function seedDefaultRateLimits() {
  const defaultRules = [
    { name: "Global API", endpoint: "*", windowSeconds: 60, maxRequests: 100, scope: "user" },
    { name: "Auth endpoints", endpoint: "/api/auth/*", windowSeconds: 60, maxRequests: 10, scope: "ip" },
    { name: "Transfer endpoints", endpoint: "/api/transfers", windowSeconds: 60, maxRequests: 20, scope: "user" },
    { name: "Withdrawal endpoints", endpoint: "/api/withdraw", windowSeconds: 3600, maxRequests: 5, scope: "user" },
  ];

  for (const rule of defaultRules) {
    await prisma.rateLimitRule.upsert({
      where: {
        id: `default-${rule.endpoint}`,
      },
      create: {
        id: `default-${rule.endpoint}`,
        ...rule,
      },
      update: rule,
    });
  }
}
