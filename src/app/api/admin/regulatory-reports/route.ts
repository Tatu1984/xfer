import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const reportSchema = z.object({
  reportType: z.enum([
    "SAR", // Suspicious Activity Report
    "CTR", // Currency Transaction Report
    "FBAR", // Foreign Bank Account Report
    "8300", // Form 8300 (cash payments over $10k)
    "AML_SUMMARY", // AML Summary Report
    "TRANSACTION_SUMMARY", // Transaction Summary
  ]),
  periodStart: z.string().transform((s) => new Date(s)),
  periodEnd: z.string().transform((s) => new Date(s)),
  jurisdiction: z.string().length(2),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// GET - List regulatory reports
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get("type");
    const status = searchParams.get("status");
    const jurisdiction = searchParams.get("jurisdiction");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (reportType) where.reportType = reportType;
    if (status) where.status = status;
    if (jurisdiction) where.jurisdiction = jurisdiction;

    const [reports, total] = await Promise.all([
      prisma.regulatoryReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.regulatoryReport.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: { total, limit, offset, hasMore: offset + reports.length < total },
    });
  } catch (error) {
    console.error("Get regulatory reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

// POST - Generate new regulatory report
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = reportSchema.parse(body);

    // Generate report data based on type
    let reportData: Record<string, unknown> = {};

    switch (data.reportType) {
      case "SAR":
        // Suspicious Activity Report - gather flagged transactions
        const suspiciousActivities = await prisma.transaction.findMany({
          where: {
            createdAt: { gte: data.periodStart, lte: data.periodEnd },
            OR: [
              { riskScore: { gte: 70 } },
              { status: "ON_HOLD" },
            ],
          },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, email: true } },
            receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        reportData = {
          suspiciousTransactions: suspiciousActivities.map((tx) => ({
            id: tx.id,
            amount: Number(tx.amount),
            currency: tx.currency,
            date: tx.createdAt,
            sender: tx.sender,
            receiver: tx.receiver,
            riskScore: tx.riskScore,
            type: tx.type,
          })),
          totalCount: suspiciousActivities.length,
          totalAmount: suspiciousActivities.reduce((sum, tx) => sum + Number(tx.amount), 0),
        };
        break;

      case "CTR":
        // Currency Transaction Report - transactions over $10,000
        const largeTransactions = await prisma.transaction.findMany({
          where: {
            createdAt: { gte: data.periodStart, lte: data.periodEnd },
            amount: { gte: 10000 },
            currency: "USD",
            status: "COMPLETED",
          },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true, email: true } },
            receiver: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        });

        reportData = {
          largeTransactions: largeTransactions.map((tx) => ({
            id: tx.id,
            amount: Number(tx.amount),
            date: tx.createdAt,
            sender: tx.sender,
            receiver: tx.receiver,
            type: tx.type,
          })),
          totalCount: largeTransactions.length,
          totalAmount: largeTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0),
        };
        break;

      case "AML_SUMMARY":
        // AML Summary - comprehensive anti-money laundering report
        const [
          highRiskTransactions,
          onHoldTransactions,
          suspendedUsers,
          sanctionsMatches,
        ] = await Promise.all([
          prisma.transaction.count({
            where: { riskScore: { gte: 70 }, createdAt: { gte: data.periodStart, lte: data.periodEnd } },
          }),
          prisma.transaction.count({
            where: { status: "ON_HOLD", createdAt: { gte: data.periodStart, lte: data.periodEnd } },
          }),
          prisma.user.count({
            where: { status: "SUSPENDED", updatedAt: { gte: data.periodStart, lte: data.periodEnd } },
          }),
          prisma.sanctionsScreening.count({
            where: {
              status: { in: ["POTENTIAL_MATCH", "CONFIRMED_MATCH"] },
              createdAt: { gte: data.periodStart, lte: data.periodEnd },
            },
          }),
        ]);

        reportData = {
          highRiskTransactions,
          onHoldTransactions,
          suspendedUsers,
          sanctionsMatches,
          period: { start: data.periodStart, end: data.periodEnd },
        };
        break;

      case "TRANSACTION_SUMMARY":
        // General transaction summary
        const [
          totalTransactions,
          totalVolume,
          byType,
          byStatus,
        ] = await Promise.all([
          prisma.transaction.count({
            where: { createdAt: { gte: data.periodStart, lte: data.periodEnd } },
          }),
          prisma.transaction.aggregate({
            where: {
              createdAt: { gte: data.periodStart, lte: data.periodEnd },
              status: "COMPLETED",
            },
            _sum: { amount: true },
          }),
          prisma.transaction.groupBy({
            by: ["type"],
            where: { createdAt: { gte: data.periodStart, lte: data.periodEnd } },
            _count: true,
            _sum: { amount: true },
          }),
          prisma.transaction.groupBy({
            by: ["status"],
            where: { createdAt: { gte: data.periodStart, lte: data.periodEnd } },
            _count: true,
          }),
        ]);

        reportData = {
          totalTransactions,
          totalVolume: Number(totalVolume._sum.amount || 0),
          byType: byType.map((t) => ({
            type: t.type,
            count: t._count,
            amount: Number(t._sum.amount || 0),
          })),
          byStatus: byStatus.map((s) => ({
            status: s.status,
            count: s._count,
          })),
        };
        break;

      default:
        reportData = { message: "Report type implementation pending" };
    }

    // Create the report
    const report = await prisma.regulatoryReport.create({
      data: {
        reportType: data.reportType,
        startDate: data.periodStart,
        endDate: data.periodEnd,
        jurisdiction: data.jurisdiction,
        status: "PENDING_REVIEW",
        reportData: reportData as object,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Generate regulatory report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// PATCH - Update report status (submit to regulator)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, status, submissionReference } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "Report ID and status required" }, { status: 400 });
    }

    const validStatuses = ["DRAFT", "PENDING_REVIEW", "SUBMITTED", "ACKNOWLEDGED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { status };

    if (status === "SUBMITTED") {
      updateData.submittedAt = new Date();
      updateData.submittedBy = authResult.id;
    }

    if (status === "ACKNOWLEDGED" && submissionReference) {
      updateData.acknowledgementRef = submissionReference;
    }

    const report = await prisma.regulatoryReport.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Update regulatory report error:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
