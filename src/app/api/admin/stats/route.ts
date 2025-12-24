import { NextRequest } from "next/server";
import {
  requireRole,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/admin/stats - Get admin dashboard statistics
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["SUPER_ADMIN", "ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    pendingKyc,
    openDisputes,
    complianceAlerts,
    totalTransactions,
    recentTransactions,
    transactionVolume,
    pendingPayouts,
  ] = await Promise.all([
    // Total users
    prisma.user.count({ where: { role: "USER" } }),

    // Active users (logged in last 30 days)
    prisma.user.count({
      where: {
        role: "USER",
        status: "ACTIVE",
        lastLoginAt: { gte: thirtyDaysAgo },
      },
    }),

    // Pending KYC
    prisma.kYCVerification.count({
      where: { status: { in: ["PENDING", "IN_REVIEW"] } },
    }),

    // Open disputes
    prisma.dispute.count({
      where: { status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } },
    }),

    // Compliance alerts
    prisma.complianceAlert.count({
      where: { status: { in: ["NEW", "INVESTIGATING"] } },
    }),

    // Total transactions
    prisma.transaction.count(),

    // Recent transactions (last 7 days)
    prisma.transaction.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),

    // Transaction volume (completed)
    prisma.transaction.aggregate({
      where: { status: "COMPLETED" },
      _sum: { amount: true },
    }),

    // Pending payouts
    prisma.payout.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
    }),
  ]);

  // Get recent activity
  const recentAlerts = await prisma.complianceAlert.findMany({
    where: { status: { in: ["NEW", "INVESTIGATING"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: {
        select: { email: true, displayName: true },
      },
    },
  });

  const pendingKycUsers = await prisma.kYCVerification.findMany({
    where: { status: { in: ["PENDING", "IN_REVIEW"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          business: { select: { legalName: true } },
        },
      },
    },
  });

  return successResponse({
    stats: {
      totalUsers,
      activeUsers,
      pendingKyc,
      openDisputes,
      complianceAlerts,
      totalTransactions,
      recentTransactions,
      transactionVolume: Number(transactionVolume._sum.amount || 0),
      pendingPayouts: Number(pendingPayouts._sum.amount || 0),
    },
    recentAlerts: recentAlerts.map((alert) => ({
      id: alert.id,
      type: alert.alertType,
      title: alert.title,
      user: alert.user.displayName || alert.user.email,
      severity: alert.severity,
      createdAt: alert.createdAt,
    })),
    pendingKycUsers: pendingKycUsers.map((kyc) => ({
      id: kyc.id,
      userId: kyc.userId,
      name:
        kyc.user.displayName ||
        `${kyc.user.firstName || ""} ${kyc.user.lastName || ""}`.trim() ||
        kyc.user.email,
      email: kyc.user.email,
      type: kyc.user.business ? "Business" : "Personal",
      status: kyc.status,
      submittedAt: kyc.createdAt,
    })),
  });
}
