import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { generateReferenceId } from "@/lib/api-utils";

const batchPayoutSchema = z.object({
  items: z.array(z.object({
    recipientEmail: z.string().email(),
    amount: z.number().positive(),
    currency: z.string().length(3).default("USD"),
    note: z.string().optional(),
  })).min(1).max(500),
  description: z.string().optional(),
});

// GET - List batch payouts
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = { businessId: business.id };
    if (status) where.status = status;

    const [batches, total] = await Promise.all([
      prisma.batchPayout.findMany({
        where,
        include: {
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.batchPayout.count({ where }),
    ]);

    return NextResponse.json({
      batches,
      pagination: { total, limit, offset, hasMore: offset + batches.length < total },
    });
  } catch (error) {
    console.error("Get batch payouts error:", error);
    return NextResponse.json({ error: "Failed to fetch batch payouts" }, { status: 500 });
  }
}

// POST - Create batch payout
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (business.kybStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Business verification required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = batchPayoutSchema.parse(body);

    // Calculate totals
    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);
    const currency = data.items[0].currency;

    // Check all items are same currency
    if (!data.items.every((item) => item.currency === currency)) {
      return NextResponse.json(
        { error: "All items must be in the same currency" },
        { status: 400 }
      );
    }

    // Check business wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: { userId: authResult.id, currency, isActive: true },
    });

    if (!wallet || Number(wallet.availableBalance) < totalAmount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    // Create batch payout
    const batchReference = generateReferenceId("BATCH");

    const batch = await prisma.$transaction(async (tx) => {
      // Create batch
      const batchPayout = await tx.batchPayout.create({
        data: {
          businessId: business.id,
          batchReference,
          totalAmount,
          totalFees: 0, // Can add fee calculation
          currency,
          itemCount: data.items.length,
          description: data.description,
          items: {
            create: data.items.map((item) => ({
              recipientEmail: item.recipientEmail,
              amount: item.amount,
              currency: item.currency,
              note: item.note,
            })),
          },
        },
        include: { items: true },
      });

      // Reserve funds
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: totalAmount },
          reservedBalance: { increment: totalAmount },
        },
      });

      // Create ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          entryType: "debit",
          amount: totalAmount,
          balanceBefore: wallet.availableBalance,
          balanceAfter: Number(wallet.availableBalance) - totalAmount,
          description: `Batch payout reserved: ${batchReference}`,
          reference: batchReference,
        },
      });

      return batchPayout;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "batch_payout_created",
        entityType: "batch_payout",
        entityId: batch.id,
        details: {
          batchReference,
          itemCount: data.items.length,
          totalAmount,
          currency,
        },
      },
    });

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchReference: batch.batchReference,
        status: batch.status,
        itemCount: batch.itemCount,
        totalAmount: Number(batch.totalAmount),
        currency: batch.currency,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create batch payout error:", error);
    return NextResponse.json({ error: "Failed to create batch payout" }, { status: 500 });
  }
}
