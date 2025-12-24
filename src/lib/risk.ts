import { prisma } from "@/lib/prisma";

export interface RiskAssessment {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  flags: string[];
  requiresReview: boolean;
  action: "ALLOW" | "BLOCK" | "REVIEW" | "STEP_UP";
}

export interface TransactionRiskInput {
  userId: string;
  amount: number;
  currency: string;
  type: string;
  recipientId?: string;
  recipientEmail?: string;
  ipAddress?: string;
  deviceId?: string;
}

// Risk weights for different factors
const RISK_WEIGHTS = {
  newAccount: 15,
  unverifiedKyc: 20,
  highAmount: 25,
  unusualVelocity: 20,
  newRecipient: 10,
  crossBorder: 10,
  unusualDevice: 15,
  previousDisputes: 30,
  suspiciousPattern: 40,
};

// Velocity thresholds
const VELOCITY_THRESHOLDS = {
  dailyCount: 10,
  dailyAmount: 5000,
  hourlyCount: 5,
  hourlyAmount: 2000,
};

// Assess transaction risk
export async function assessTransactionRisk(
  input: TransactionRiskInput
): Promise<RiskAssessment> {
  const flags: string[] = [];
  let totalScore = 0;

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      kycVerification: true,
      riskProfile: true,
      wallets: { where: { currency: input.currency } },
    },
  });

  if (!user) {
    return {
      score: 100,
      level: "CRITICAL",
      flags: ["USER_NOT_FOUND"],
      requiresReview: true,
      action: "BLOCK",
    };
  }

  // 1. Check account age
  const accountAgeDays = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (accountAgeDays < 7) {
    flags.push("NEW_ACCOUNT");
    totalScore += RISK_WEIGHTS.newAccount;
  }

  // 2. Check KYC status
  if (!user.kycVerification || user.kycVerification.status !== "APPROVED") {
    flags.push("UNVERIFIED_KYC");
    totalScore += RISK_WEIGHTS.unverifiedKyc;
  }

  // 3. Check amount thresholds
  const riskProfile = user.riskProfile;
  if (riskProfile) {
    const singleLimit = Number(riskProfile.singleTxLimit);
    if (input.amount > singleLimit) {
      flags.push("EXCEEDS_SINGLE_TX_LIMIT");
      totalScore += RISK_WEIGHTS.highAmount;
    }

    const dailyLimit = Number(riskProfile.dailyLimit);
    const dailyVolume = Number(riskProfile.dailyTransactionVolume);
    if (dailyVolume + input.amount > dailyLimit) {
      flags.push("EXCEEDS_DAILY_LIMIT");
      totalScore += RISK_WEIGHTS.highAmount;
    }
  } else if (input.amount > 1000) {
    flags.push("HIGH_AMOUNT");
    totalScore += RISK_WEIGHTS.highAmount;
  }

  // 4. Check velocity (transactions in last hour and day)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [hourlyTxs, dailyTxs] = await Promise.all([
    prisma.transaction.count({
      where: {
        senderId: input.userId,
        createdAt: { gte: oneHourAgo },
      },
    }),
    prisma.transaction.aggregate({
      where: {
        senderId: input.userId,
        createdAt: { gte: oneDayAgo },
      },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  if (hourlyTxs >= VELOCITY_THRESHOLDS.hourlyCount) {
    flags.push("HIGH_HOURLY_VELOCITY");
    totalScore += RISK_WEIGHTS.unusualVelocity;
  }

  if (dailyTxs._count >= VELOCITY_THRESHOLDS.dailyCount) {
    flags.push("HIGH_DAILY_VELOCITY");
    totalScore += RISK_WEIGHTS.unusualVelocity;
  }

  // 5. Check if new recipient
  if (input.recipientId) {
    const previousTxToRecipient = await prisma.transaction.findFirst({
      where: {
        senderId: input.userId,
        receiverId: input.recipientId,
        createdAt: { lt: oneDayAgo },
      },
    });

    if (!previousTxToRecipient) {
      flags.push("NEW_RECIPIENT");
      totalScore += RISK_WEIGHTS.newRecipient;
    }
  }

  // 6. Check dispute history
  const disputeCount = await prisma.dispute.count({
    where: {
      OR: [{ createdById: input.userId }, { respondentId: input.userId }],
    },
  });

  if (disputeCount > 0) {
    flags.push("PREVIOUS_DISPUTES");
    totalScore += RISK_WEIGHTS.previousDisputes * Math.min(disputeCount, 3);
  }

  // 7. Check device (if provided)
  if (input.deviceId) {
    const device = await prisma.device.findFirst({
      where: {
        userId: input.userId,
        deviceId: input.deviceId,
      },
    });

    if (!device) {
      flags.push("UNKNOWN_DEVICE");
      totalScore += RISK_WEIGHTS.unusualDevice;
    } else if (!device.isTrusted) {
      flags.push("UNTRUSTED_DEVICE");
      totalScore += Math.floor(RISK_WEIGHTS.unusualDevice / 2);
    }
  }

  // Calculate risk level and action
  let level: RiskAssessment["level"];
  let action: RiskAssessment["action"];
  let requiresReview = false;

  if (totalScore >= 80) {
    level = "CRITICAL";
    action = "BLOCK";
    requiresReview = true;
  } else if (totalScore >= 60) {
    level = "HIGH";
    action = "REVIEW";
    requiresReview = true;
  } else if (totalScore >= 40) {
    level = "MEDIUM";
    action = "STEP_UP";
    requiresReview = false;
  } else {
    level = "LOW";
    action = "ALLOW";
    requiresReview = false;
  }

  return {
    score: Math.min(totalScore, 100),
    level,
    flags,
    requiresReview,
    action,
  };
}

// Update user's risk profile after transaction
export async function updateRiskProfile(
  userId: string,
  amount: number,
  isDispute: boolean = false
): Promise<void> {
  const now = new Date();
  const startOfDay = new Date(now.setHours(0, 0, 0, 0));
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Get current stats
  const [dailyStats, weeklyStats, monthlyStats] = await Promise.all([
    prisma.transaction.aggregate({
      where: { senderId: userId, createdAt: { gte: startOfDay } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { senderId: userId, createdAt: { gte: startOfWeek } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { senderId: userId, createdAt: { gte: startOfMonth } },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  // Get account age
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const accountAge = user
    ? Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Get dispute counts
  const [disputeCount, chargebackCount] = await Promise.all([
    prisma.dispute.count({ where: { createdById: userId } }),
    prisma.dispute.count({
      where: {
        respondentId: userId,
        status: { in: ["RESOLVED_BUYER_FAVOR", "ESCALATED"] },
      },
    }),
  ]);

  // Calculate new risk score
  let riskScore = 0;
  if (accountAge < 30) riskScore += 10;
  if (disputeCount > 0) riskScore += disputeCount * 5;
  if (chargebackCount > 0) riskScore += chargebackCount * 15;

  // Determine risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (riskScore >= 60) riskLevel = "CRITICAL";
  else if (riskScore >= 40) riskLevel = "HIGH";
  else if (riskScore >= 20) riskLevel = "MEDIUM";

  // Upsert risk profile
  await prisma.riskProfile.upsert({
    where: { userId },
    update: {
      riskScore,
      riskLevel,
      accountAge,
      disputeCount,
      chargebackCount,
      dailyTransactionCount: dailyStats._count,
      dailyTransactionVolume: dailyStats._sum.amount || 0,
      weeklyTransactionCount: weeklyStats._count,
      weeklyTransactionVolume: weeklyStats._sum.amount || 0,
      monthlyTransactionCount: monthlyStats._count,
      monthlyTransactionVolume: monthlyStats._sum.amount || 0,
      lastUpdated: new Date(),
    },
    create: {
      userId,
      riskScore,
      riskLevel,
      accountAge,
      disputeCount,
      chargebackCount,
      dailyTransactionCount: dailyStats._count,
      dailyTransactionVolume: dailyStats._sum.amount || 0,
      weeklyTransactionCount: weeklyStats._count,
      weeklyTransactionVolume: weeklyStats._sum.amount || 0,
      monthlyTransactionCount: monthlyStats._count,
      monthlyTransactionVolume: monthlyStats._sum.amount || 0,
    },
  });
}

// Check and apply risk rules
export async function applyRiskRules(
  input: TransactionRiskInput
): Promise<{ allowed: boolean; reason?: string; ruleId?: string }> {
  // Get active rules sorted by priority
  const rules = await prisma.riskRule.findMany({
    where: { isActive: true },
    orderBy: { priority: "desc" },
  });

  for (const rule of rules) {
    const conditions = rule.conditions as Record<string, unknown>;
    let matches = true;

    // Check conditions
    if (conditions.minAmount && input.amount < (conditions.minAmount as number)) {
      matches = false;
    }
    if (conditions.maxAmount && input.amount > (conditions.maxAmount as number)) {
      matches = false;
    }
    if (conditions.currencies && !(conditions.currencies as string[]).includes(input.currency)) {
      matches = false;
    }
    if (conditions.transactionTypes && !(conditions.transactionTypes as string[]).includes(input.type)) {
      matches = false;
    }

    if (matches) {
      if (rule.action === "block") {
        return { allowed: false, reason: rule.name, ruleId: rule.id };
      }
      if (rule.action === "allow") {
        return { allowed: true, ruleId: rule.id };
      }
    }
  }

  return { allowed: true };
}
