import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const generateReportSchema = z.object({
  type: z.enum(["TRANSACTION", "USER", "COMPLIANCE", "REVENUE"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// GET - List generated reports
export async function GET(request: NextRequest) {
  try {
    await requireRole(["ADMIN", "SUPER_ADMIN"]);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "20");

    // For now, generate report data on the fly
    // In production, you would store generated reports in a Report table

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get summary statistics
    const [
      totalTransactions,
      transactionVolume,
      totalUsers,
      newUsers,
      activeUsers,
    ] = await Promise.all([
      prisma.transaction.count(),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: "COMPLETED" },
      }),
      prisma.user.count(),
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      prisma.user.count({
        where: { lastLoginAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    // Mock recent reports (in production, fetch from Report table)
    const reports = [
      {
        id: "rpt_1",
        name: "Monthly Transaction Report",
        description: "Summary of all transactions for the current month",
        type: "TRANSACTION",
        status: "COMPLETED",
        generatedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        size: "2.4 MB",
      },
      {
        id: "rpt_2",
        name: "User Growth Report",
        description: "New user registrations and activity metrics",
        type: "USER",
        status: "COMPLETED",
        generatedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        size: "1.2 MB",
      },
      {
        id: "rpt_3",
        name: "Compliance Summary",
        description: "Monthly compliance alerts and resolutions",
        type: "COMPLIANCE",
        status: "COMPLETED",
        generatedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        size: "856 KB",
      },
      {
        id: "rpt_4",
        name: "Revenue Report",
        description: "Platform revenue breakdown by source",
        type: "REVENUE",
        status: "COMPLETED",
        generatedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        size: "1.8 MB",
      },
    ];

    const filteredReports = type
      ? reports.filter((r) => r.type === type)
      : reports;

    return NextResponse.json({
      reports: filteredReports.slice(0, limit),
      summary: {
        totalTransactions,
        transactionVolume: transactionVolume._sum.amount || 0,
        totalUsers,
        newUsers,
        activeUsers,
      },
    });
  } catch (error) {
    console.error("Get reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

// POST - Generate a new report
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string };
    const body = await request.json();
    const data = generateReportSchema.parse(body);

    const now = new Date();
    const startDate = data.startDate ? new Date(data.startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endDate = data.endDate ? new Date(data.endDate) : now;

    let reportData: Record<string, unknown> = {};
    let reportName = "";
    let reportDescription = "";

    switch (data.type) {
      case "TRANSACTION": {
        const [transactions, volume, byStatus] = await Promise.all([
          prisma.transaction.count({
            where: { createdAt: { gte: startDate, lte: endDate } },
          }),
          prisma.transaction.aggregate({
            _sum: { amount: true },
            where: { createdAt: { gte: startDate, lte: endDate }, status: "COMPLETED" },
          }),
          prisma.transaction.groupBy({
            by: ["status"],
            _count: true,
            where: { createdAt: { gte: startDate, lte: endDate } },
          }),
        ]);

        reportData = {
          totalTransactions: transactions,
          totalVolume: volume._sum.amount || 0,
          byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        };
        reportName = "Transaction Report";
        reportDescription = `Transactions from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
        break;
      }

      case "USER": {
        const [totalUsers, newUsers, byRole, byStatus] = await Promise.all([
          prisma.user.count({
            where: { createdAt: { lte: endDate } },
          }),
          prisma.user.count({
            where: { createdAt: { gte: startDate, lte: endDate } },
          }),
          prisma.user.groupBy({
            by: ["role"],
            _count: true,
          }),
          prisma.user.groupBy({
            by: ["status"],
            _count: true,
          }),
        ]);

        reportData = {
          totalUsers,
          newUsers,
          byRole: byRole.reduce((acc, r) => ({ ...acc, [r.role]: r._count }), {}),
          byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
        };
        reportName = "User Report";
        reportDescription = `User metrics from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
        break;
      }

      case "COMPLIANCE": {
        const [totalAlerts, byStatus, bySeverity] = await Promise.all([
          prisma.complianceAlert.count({
            where: { createdAt: { gte: startDate, lte: endDate } },
          }),
          prisma.complianceAlert.groupBy({
            by: ["status"],
            _count: true,
            where: { createdAt: { gte: startDate, lte: endDate } },
          }),
          prisma.complianceAlert.groupBy({
            by: ["severity"],
            _count: true,
            where: { createdAt: { gte: startDate, lte: endDate } },
          }),
        ]);

        reportData = {
          totalAlerts,
          byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
          bySeverity: bySeverity.reduce((acc, s) => ({ ...acc, [s.severity]: s._count }), {}),
        };
        reportName = "Compliance Report";
        reportDescription = `Compliance alerts from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
        break;
      }

      case "REVENUE": {
        const [platformFees, transactionFees] = await Promise.all([
          prisma.transaction.aggregate({
            _sum: { fee: true },
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: "COMPLETED",
            },
          }),
          prisma.transaction.count({
            where: {
              createdAt: { gte: startDate, lte: endDate },
              status: "COMPLETED",
            },
          }),
        ]);

        reportData = {
          totalFees: platformFees._sum.fee || 0,
          totalTransactions: transactionFees,
          avgFeePerTransaction: transactionFees > 0
            ? (Number(platformFees._sum.fee || 0) / transactionFees).toFixed(2)
            : 0,
        };
        reportName = "Revenue Report";
        reportDescription = `Revenue from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`;
        break;
      }
    }

    // Log the activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "REPORT_GENERATED",
        entityType: "REPORT",
        entityId: data.type,
        details: {
          type: data.type,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });

    return NextResponse.json({
      id: `rpt_${Date.now()}`,
      name: reportName,
      description: reportDescription,
      type: data.type,
      status: "COMPLETED",
      generatedAt: now.toISOString(),
      data: reportData,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Generate report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
