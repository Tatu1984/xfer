import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { generateReferenceId } from "@/lib/api-utils";

const createBatchSchema = z.object({
  companyAccountId: z.string(),
  settlementDate: z.string().datetime(),
  currency: z.string().length(3),
});

// GET - List settlement batches
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [batches, total] = await Promise.all([
      prisma.settlementBatch.findMany({
        where,
        include: {
          companyAccount: {
            select: { accountName: true, bankName: true, currency: true },
          },
          _count: { select: { items: true } },
        },
        orderBy: { settlementDate: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.settlementBatch.count({ where }),
    ]);

    // Get summary stats
    const stats = await prisma.settlementBatch.aggregate({
      where: { status: "COMPLETED" },
      _sum: { netAmount: true },
      _count: true,
    });

    return NextResponse.json({
      batches,
      stats: {
        totalSettled: Number(stats._sum.netAmount || 0),
        completedBatches: stats._count,
      },
      pagination: { total, limit, offset, hasMore: offset + batches.length < total },
    });
  } catch (error) {
    console.error("Get settlements error:", error);
    return NextResponse.json({ error: "Failed to fetch settlements" }, { status: 500 });
  }
}

// POST - Create settlement batch
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const data = createBatchSchema.parse(body);

    // Verify company account exists
    const companyAccount = await prisma.companyBankAccount.findUnique({
      where: { id: data.companyAccountId },
    });

    if (!companyAccount || !companyAccount.isActive) {
      return NextResponse.json({ error: "Company account not found or inactive" }, { status: 404 });
    }

    const settlementDate = new Date(data.settlementDate);
    const cutoffTime = new Date(settlementDate);
    cutoffTime.setHours(17, 0, 0, 0); // 5 PM cutoff

    // Find unsettled transactions
    const unsettledTxs = await prisma.transaction.findMany({
      where: {
        currency: data.currency,
        status: "COMPLETED",
        processedAt: { lt: cutoffTime },
        // Only include transactions that haven't been settled
        NOT: {
          id: {
            in: (await prisma.settlementItem.findMany({
              select: { transactionId: true },
            })).map((i) => i.transactionId),
          },
        },
      },
      select: {
        id: true,
        amount: true,
        fee: true,
        netAmount: true,
        type: true,
      },
    });

    if (unsettledTxs.length === 0) {
      return NextResponse.json({ error: "No transactions to settle" }, { status: 400 });
    }

    // Calculate totals
    let totalCredits = 0;
    let totalDebits = 0;

    unsettledTxs.forEach((tx) => {
      if (["DEPOSIT", "PAYMENT", "TRANSFER_IN"].includes(tx.type)) {
        totalCredits += Number(tx.netAmount);
      } else if (["WITHDRAWAL", "PAYOUT", "REFUND", "TRANSFER_OUT"].includes(tx.type)) {
        totalDebits += Number(tx.netAmount);
      }
    });

    const netAmount = totalCredits - totalDebits;
    const batchReference = generateReferenceId("STL");

    // Create batch with items
    const batch = await prisma.settlementBatch.create({
      data: {
        batchReference,
        companyAccountId: data.companyAccountId,
        settlementDate,
        cutoffTime,
        totalCredits,
        totalDebits,
        netAmount,
        currency: data.currency,
        transactionCount: unsettledTxs.length,
        items: {
          create: unsettledTxs.map((tx) => ({
            transactionId: tx.id,
            amount: tx.amount,
            fee: tx.fee,
            netAmount: tx.netAmount,
          })),
        },
      },
      include: {
        _count: { select: { items: true } },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "settlement_batch_created",
        entityType: "settlement_batch",
        entityId: batch.id,
        details: {
          batchReference,
          transactionCount: unsettledTxs.length,
          netAmount,
          currency: data.currency,
        },
      },
    });

    return NextResponse.json({
      batch,
      summary: {
        transactionCount: unsettledTxs.length,
        totalCredits,
        totalDebits,
        netAmount,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create settlement batch error:", error);
    return NextResponse.json({ error: "Failed to create settlement batch" }, { status: 500 });
  }
}

// PUT - Process settlement batch
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireRole(["SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { batchId } = body;

    if (!batchId) {
      return NextResponse.json({ error: "Batch ID required" }, { status: 400 });
    }

    const batch = await prisma.settlementBatch.findUnique({
      where: { id: batchId },
      include: { items: true, companyAccount: true },
    });

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    if (batch.status !== "PENDING") {
      return NextResponse.json({ error: "Batch already processed" }, { status: 400 });
    }

    // Update batch status to processing
    await prisma.settlementBatch.update({
      where: { id: batchId },
      data: { status: "PROCESSING" },
    });

    try {
      // Process each item
      const now = new Date();

      await prisma.settlementItem.updateMany({
        where: { batchId },
        data: { status: "SETTLED", settledAt: now },
      });

      // Update company account balance
      await prisma.companyBankAccount.update({
        where: { id: batch.companyAccountId },
        data: {
          balance: { increment: batch.netAmount },
          lastReconciled: now,
        },
      });

      // Create company ledger entry
      await prisma.companyLedgerEntry.create({
        data: {
          accountId: batch.companyAccountId,
          entryType: Number(batch.netAmount) >= 0 ? "credit" : "debit",
          amount: Math.abs(Number(batch.netAmount)),
          balanceBefore: batch.companyAccount.balance,
          balanceAfter: Number(batch.companyAccount.balance) + Number(batch.netAmount),
          description: `Settlement batch: ${batch.batchReference}`,
          reference: batch.batchReference,
          relatedType: "settlement",
          relatedId: batch.id,
        },
      });

      // Mark batch as completed
      await prisma.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: "COMPLETED",
          processedAt: now,
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: authResult.id,
          action: "settlement_batch_processed",
          entityType: "settlement_batch",
          entityId: batchId,
          details: {
            batchReference: batch.batchReference,
            itemCount: batch.items.length,
            netAmount: batch.netAmount,
          },
        },
      });

      return NextResponse.json({
        success: true,
        batch: await prisma.settlementBatch.findUnique({
          where: { id: batchId },
        }),
      });
    } catch (processError) {
      // Mark batch as failed
      await prisma.settlementBatch.update({
        where: { id: batchId },
        data: {
          status: "FAILED",
          failureReason: processError instanceof Error ? processError.message : "Unknown error",
        },
      });

      throw processError;
    }
  } catch (error) {
    console.error("Process settlement batch error:", error);
    return NextResponse.json({ error: "Failed to process settlement" }, { status: 500 });
  }
}
