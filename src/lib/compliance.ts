import { prisma } from "@/lib/prisma";

export interface SARReport {
  id: string;
  userId: string;
  reportType: "SAR" | "STR" | "CTR";
  status: "DRAFT" | "SUBMITTED" | "FILED" | "CLOSED";
  filingDate?: Date;
  alertIds: string[];
  transactionIds: string[];
  totalAmount: number;
  narrative: string;
  suspiciousIndicators: string[];
  createdAt: Date;
  submittedBy?: string;
}

// Transaction monitoring patterns
export const SUSPICIOUS_PATTERNS = {
  STRUCTURING: "Transactions structured to avoid reporting thresholds",
  RAPID_MOVEMENT: "Rapid movement of funds through accounts",
  UNUSUAL_VOLUME: "Unusual transaction volume for account profile",
  HIGH_RISK_COUNTRY: "Transactions involving high-risk jurisdictions",
  ROUND_AMOUNTS: "Frequent transactions in round amounts",
  LAYERING: "Complex layering of transactions",
  DORMANT_REACTIVATED: "Reactivation of dormant account with large transactions",
  INCONSISTENT_PROFILE: "Transactions inconsistent with customer profile",
  EARLY_WITHDRAWAL: "Quick withdrawal after deposit",
  MULTIPLE_BENEFICIARIES: "Multiple beneficiaries from single source",
} as const;

// Currency Transaction Report threshold (US)
const CTR_THRESHOLD = 10000;

// Check if transaction requires CTR
export function requiresCTR(amount: number, currency: string): boolean {
  // Convert to USD equivalent for threshold check
  // Simplified - in production use actual exchange rates
  const usdAmount = currency === "USD" ? amount : amount * 0.9;
  return usdAmount >= CTR_THRESHOLD;
}

// Generate CTR if needed
export async function checkCTRRequirement(
  userId: string,
  amount: number,
  currency: string,
  transactionId: string
): Promise<void> {
  if (!requiresCTR(amount, currency)) return;

  // Create compliance alert for CTR
  await prisma.complianceAlert.create({
    data: {
      userId,
      alertType: "CTR_REQUIRED",
      severity: "MEDIUM",
      title: "Currency Transaction Report Required",
      description: `Transaction of ${currency} ${amount.toFixed(2)} exceeds CTR threshold`,
      details: {
        transactionId,
        amount,
        currency,
        threshold: CTR_THRESHOLD,
      },
    },
  });
}

// Monitor for structuring
export async function checkStructuring(
  userId: string,
  amount: number,
  currency: string
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all transactions in last 24 hours
  const recentTxs = await prisma.transaction.findMany({
    where: {
      senderId: userId,
      currency,
      createdAt: { gte: twentyFourHoursAgo },
      status: "COMPLETED",
    },
    select: { amount: true },
  });

  // Check if total exceeds threshold but individual transactions don't
  const totalAmount = recentTxs.reduce((sum, tx) => sum + Number(tx.amount), 0) + amount;
  const allUnderThreshold = recentTxs.every((tx) => Number(tx.amount) < CTR_THRESHOLD);
  const currentUnderThreshold = amount < CTR_THRESHOLD;

  if (totalAmount >= CTR_THRESHOLD && allUnderThreshold && currentUnderThreshold) {
    // Potential structuring detected
    await prisma.complianceAlert.create({
      data: {
        userId,
        alertType: "STRUCTURING_SUSPECTED",
        severity: "HIGH",
        title: "Potential Structuring Detected",
        description: `Multiple transactions totaling ${currency} ${totalAmount.toFixed(2)} may indicate structuring`,
        details: {
          totalAmount,
          transactionCount: recentTxs.length + 1,
          threshold: CTR_THRESHOLD,
          pattern: SUSPICIOUS_PATTERNS.STRUCTURING,
        },
      },
    });
    return true;
  }

  return false;
}

// Check for rapid fund movement
export async function checkRapidMovement(
  userId: string,
  amount: number
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Check for deposits followed by quick withdrawals
  const recentDeposits = await prisma.transaction.aggregate({
    where: {
      receiverId: userId,
      type: { in: ["DEPOSIT", "TRANSFER_IN"] },
      createdAt: { gte: oneHourAgo },
      status: "COMPLETED",
    },
    _sum: { amount: true },
  });

  const depositAmount = Number(recentDeposits._sum.amount || 0);

  // If trying to move more than 80% of recent deposits within an hour
  if (depositAmount > 0 && amount >= depositAmount * 0.8) {
    await prisma.complianceAlert.create({
      data: {
        userId,
        alertType: "RAPID_MOVEMENT",
        severity: "MEDIUM",
        title: "Rapid Fund Movement Detected",
        description: `Attempting to move ${amount.toFixed(2)} shortly after receiving ${depositAmount.toFixed(2)}`,
        details: {
          outgoingAmount: amount,
          recentDeposits: depositAmount,
          pattern: SUSPICIOUS_PATTERNS.RAPID_MOVEMENT,
        },
      },
    });
    return true;
  }

  return false;
}

// Check for round amount patterns
export async function checkRoundAmounts(
  userId: string,
  amount: number
): Promise<boolean> {
  // Round amounts are multiples of 100 or 1000
  const isRound = amount % 100 === 0;

  if (!isRound) return false;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const roundTxCount = await prisma.transaction.count({
    where: {
      senderId: userId,
      createdAt: { gte: sevenDaysAgo },
      status: "COMPLETED",
      amount: {
        // Check if amount is divisible by 100
        // This is a simplified check - Prisma doesn't support modulo directly
        in: Array.from({ length: 100 }, (_, i) => (i + 1) * 100),
      },
    },
  });

  // If more than 5 round-amount transactions in a week
  if (roundTxCount >= 5) {
    await prisma.complianceAlert.create({
      data: {
        userId,
        alertType: "ROUND_AMOUNTS",
        severity: "LOW",
        title: "Pattern of Round Amount Transactions",
        description: `${roundTxCount + 1} transactions in round amounts detected`,
        details: {
          count: roundTxCount + 1,
          pattern: SUSPICIOUS_PATTERNS.ROUND_AMOUNTS,
        },
      },
    });
    return true;
  }

  return false;
}

// Create SAR/STR report
export async function createSARReport(
  userId: string,
  alertIds: string[],
  transactionIds: string[],
  narrative: string,
  suspiciousIndicators: string[],
  createdBy: string
): Promise<string> {
  // Calculate total amount from transactions
  const transactions = await prisma.transaction.findMany({
    where: { id: { in: transactionIds } },
    select: { amount: true },
  });

  const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Create report in database (using ComplianceAlert as container)
  const report = await prisma.complianceAlert.create({
    data: {
      userId,
      alertType: "SAR_REPORT",
      severity: "CRITICAL",
      title: "Suspicious Activity Report",
      description: narrative.substring(0, 500),
      status: "NEW",
      details: {
        reportType: "SAR",
        status: "DRAFT",
        alertIds,
        transactionIds,
        totalAmount,
        narrative,
        suspiciousIndicators,
        createdBy,
      },
    },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: createdBy,
      action: "sar_created",
      entityType: "compliance_alert",
      entityId: report.id,
      details: {
        targetUserId: userId,
        alertCount: alertIds.length,
        transactionCount: transactionIds.length,
      },
    },
  });

  return report.id;
}

// Run all transaction monitoring checks
export async function monitorTransaction(
  userId: string,
  amount: number,
  currency: string,
  transactionId: string
): Promise<{
  alerts: string[];
  requiresReview: boolean;
}> {
  const alerts: string[] = [];

  // Run all checks in parallel
  const [ctrRequired, structuring, rapidMovement, roundAmounts] = await Promise.all([
    Promise.resolve(requiresCTR(amount, currency)),
    checkStructuring(userId, amount, currency),
    checkRapidMovement(userId, amount),
    checkRoundAmounts(userId, amount),
  ]);

  if (ctrRequired) {
    await checkCTRRequirement(userId, amount, currency, transactionId);
    alerts.push("CTR_REQUIRED");
  }

  if (structuring) alerts.push("STRUCTURING_SUSPECTED");
  if (rapidMovement) alerts.push("RAPID_MOVEMENT");
  if (roundAmounts) alerts.push("ROUND_AMOUNTS");

  return {
    alerts,
    requiresReview: alerts.length > 0,
  };
}

// Get compliance dashboard stats
export async function getComplianceStats(): Promise<{
  pendingAlerts: number;
  criticalAlerts: number;
  sarReportsThisMonth: number;
  alertsByType: Record<string, number>;
}> {
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [pendingAlerts, criticalAlerts, sarReports, alertsByType] = await Promise.all([
    prisma.complianceAlert.count({ where: { status: "NEW" } }),
    prisma.complianceAlert.count({ where: { severity: "CRITICAL", status: "NEW" } }),
    prisma.complianceAlert.count({
      where: {
        alertType: "SAR_REPORT",
        createdAt: { gte: startOfMonth },
      },
    }),
    prisma.complianceAlert.groupBy({
      by: ["alertType"],
      where: { status: "NEW" },
      _count: true,
    }),
  ]);

  return {
    pendingAlerts,
    criticalAlerts,
    sarReportsThisMonth: sarReports,
    alertsByType: Object.fromEntries(
      alertsByType.map((a) => [a.alertType, a._count])
    ),
  };
}
