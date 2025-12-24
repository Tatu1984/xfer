import { prisma } from "@/lib/prisma";

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutStatus {
  isLocked: boolean;
  remainingAttempts: number;
  lockoutEndsAt?: Date;
  attemptCount: number;
}

// Check if account is locked
export async function checkAccountLockout(
  userId: string
): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      failedLoginAttempts: true,
      lockedUntil: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    return {
      isLocked: false,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      attemptCount: 0,
    };
  }

  // Check if currently locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return {
      isLocked: true,
      remainingAttempts: 0,
      lockoutEndsAt: user.lockedUntil,
      attemptCount: user.failedLoginAttempts,
    };
  }

  // Reset attempts if lockout has expired or window has passed
  const lastAttempt = user.lastLoginAt?.getTime() || 0;
  const windowExpired = Date.now() - lastAttempt > ATTEMPT_WINDOW_MS;

  if (windowExpired || (user.lockedUntil && user.lockedUntil <= new Date())) {
    // Reset the counter
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return {
      isLocked: false,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      attemptCount: 0,
    };
  }

  return {
    isLocked: false,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - user.failedLoginAttempts),
    attemptCount: user.failedLoginAttempts,
  };
}

// Record a failed login attempt
export async function recordFailedAttempt(
  userId: string
): Promise<LockoutStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { failedLoginAttempts: true },
  });

  if (!user) {
    return {
      isLocked: false,
      remainingAttempts: MAX_LOGIN_ATTEMPTS,
      attemptCount: 0,
    };
  }

  const newAttemptCount = user.failedLoginAttempts + 1;
  const shouldLock = newAttemptCount >= MAX_LOGIN_ATTEMPTS;

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: newAttemptCount,
      ...(shouldLock
        ? { lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) }
        : {}),
    },
  });

  // Log the failed attempt
  await prisma.activityLog.create({
    data: {
      userId,
      action: shouldLock ? "account_locked" : "login_failed",
      entityType: "user",
      entityId: userId,
      details: {
        attemptCount: newAttemptCount,
        ...(shouldLock ? { lockoutDurationMinutes: LOCKOUT_DURATION_MS / 60000 } : {}),
      },
    },
  });

  // Create notification if locked
  if (shouldLock) {
    await prisma.notification.create({
      data: {
        userId,
        type: "security",
        title: "Account Temporarily Locked",
        message: `Your account has been locked due to ${MAX_LOGIN_ATTEMPTS} failed login attempts. It will be unlocked in 30 minutes.`,
      },
    });
  }

  return {
    isLocked: shouldLock,
    remainingAttempts: Math.max(0, MAX_LOGIN_ATTEMPTS - newAttemptCount),
    lockoutEndsAt: shouldLock ? updated.lockedUntil || undefined : undefined,
    attemptCount: newAttemptCount,
  };
}

// Record a successful login (reset attempts)
export async function recordSuccessfulLogin(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    },
  });
}

// Admin: Manually unlock account
export async function unlockAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: "account_unlocked",
      entityType: "user",
      entityId: userId,
      details: { unlockedBy: "admin" },
    },
  });

  await prisma.notification.create({
    data: {
      userId,
      type: "security",
      title: "Account Unlocked",
      message: "Your account has been unlocked. You can now log in.",
    },
  });
}

// Check if email/IP is blocked (for login by email before user lookup)
export async function checkLoginBlocked(
  identifier: string,
  type: "email" | "ip"
): Promise<boolean> {
  // Check rate limit table or use in-memory rate limiter
  const { authRateLimit } = await import("@/lib/rate-limit");
  const result = authRateLimit(identifier);
  return !result.success;
}
