import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const reconciliationSchema = z.object({
  reportDate: z.string().transform((s) => new Date(s)),
  accountId: z.string(),
});

// GET - List reconciliation reports
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");
    const accountId = searchParams.get("accountId");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (id) {
      const report = await prisma.reconciliationReport.findUnique({
        where: { id },
      });

      if (!report) {
        return NextResponse.json({ error: "Report not found" }, { status: 404 });
      }

      return NextResponse.json({ report });
    }

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (accountId) where.accountId = accountId;

    const [reports, total] = await Promise.all([
      prisma.reconciliationReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.reconciliationReport.count({ where }),
    ]);

    return NextResponse.json({
      reports,
      pagination: { total, limit, offset, hasMore: offset + reports.length < total },
    });
  } catch (error) {
    console.error("Get reconciliation reports error:", error);
    return NextResponse.json({ error: "Failed to fetch reports" }, { status: 500 });
  }
}

// POST - Generate reconciliation report
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = reconciliationSchema.parse(body);

    // Get company account
    const account = await prisma.companyBankAccount.findUnique({
      where: { id: data.accountId },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Calculate expected values from ledger
    const ledgerSum = await prisma.companyLedgerEntry.aggregate({
      where: { accountId: account.id },
      _sum: { amount: true },
      _count: true,
    });

    const expectedBalance = Number(ledgerSum._sum.amount || 0);
    const expectedTransactions = ledgerSum._count;

    // Create report
    const report = await prisma.reconciliationReport.create({
      data: {
        reportDate: data.reportDate,
        accountId: data.accountId,
        status: "PENDING",
        expectedBalance,
        expectedTransactions,
      },
    });

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Generate reconciliation report error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// PATCH - Update reconciliation status
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, status, actualBalance, actualTransactions, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Report ID required" }, { status: 400 });
    }

    const report = await prisma.reconciliationReport.findUnique({
      where: { id },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      const validStatuses = ["PENDING", "IN_PROGRESS", "BALANCED", "DISCREPANCY"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status;
    }

    if (actualBalance !== undefined) {
      updateData.actualBalance = actualBalance;
      updateData.actualTransactions = actualTransactions;

      // Calculate discrepancy
      const discrepancy = Number(report.expectedBalance) - actualBalance;
      updateData.discrepancyAmount = Math.abs(discrepancy);

      if (Math.abs(discrepancy) < 0.01) {
        updateData.status = "BALANCED";
      } else {
        updateData.status = "DISCREPANCY";
      }
    }

    if (notes) {
      updateData.notes = notes;
    }

    if (updateData.status === "BALANCED" || updateData.status === "DISCREPANCY") {
      updateData.reconciledBy = authResult.id;
      updateData.reconciledAt = new Date();
    }

    const updated = await prisma.reconciliationReport.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ report: updated });
  } catch (error) {
    console.error("Update reconciliation report error:", error);
    return NextResponse.json({ error: "Failed to update report" }, { status: 500 });
  }
}
