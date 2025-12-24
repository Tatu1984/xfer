import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const representmentSchema = z.object({
  chargebackId: z.string(),
  evidence: z.object({
    description: z.string(),
    trackingNumber: z.string().optional(),
    trackingCarrier: z.string().optional(),
    deliveryConfirmation: z.string().optional(),
    communicationLog: z.string().optional(),
    refundPolicy: z.string().optional(),
    signedReceipt: z.string().optional(),
    additionalDocuments: z.array(z.string()).optional(),
  }),
});

// GET - List chargebacks
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR", "ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    let where: Record<string, unknown> = {};

    // If vendor, only show their chargebacks
    if (authResult.role === "VENDOR") {
      const business = await prisma.business.findUnique({
        where: { userId: authResult.id },
      });

      if (!business) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }

      // Get orders for this merchant
      const orderIds = await prisma.order.findMany({
        where: { merchantId: business.id },
        select: { id: true },
      });

      // Get transactions for these orders
      const transactionIds = await prisma.transaction.findMany({
        where: { orderId: { in: orderIds.map((o) => o.id) } },
        select: { id: true },
      });

      where.transactionId = { in: transactionIds.map((t) => t.id) };
    }

    if (status) {
      where.status = status;
    }

    const [chargebacks, total] = await Promise.all([
      prisma.chargeback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.chargeback.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.chargeback.groupBy({
      by: ["status"],
      where: authResult.role === "VENDOR" ? where : {},
      _count: true,
      _sum: { amount: true },
    });

    return NextResponse.json({
      chargebacks,
      stats: Object.fromEntries(
        stats.map((s) => [s.status, { count: s._count, amount: Number(s._sum.amount) }])
      ),
      pagination: { total, limit, offset, hasMore: offset + chargebacks.length < total },
    });
  } catch (error) {
    console.error("Get chargebacks error:", error);
    return NextResponse.json({ error: "Failed to fetch chargebacks" }, { status: 500 });
  }
}

// POST - Create chargeback (admin only - simulates receiving from bank)
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { transactionId, reasonCode, reason, amount } = body;

    // Check if chargeback already exists
    const existing = await prisma.chargeback.findUnique({
      where: { transactionId },
    });

    if (existing) {
      return NextResponse.json({ error: "Chargeback already exists for this transaction" }, { status: 400 });
    }

    // Get transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Calculate response deadline (usually 7-14 days)
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 10);

    const chargeback = await prisma.chargeback.create({
      data: {
        transactionId,
        amount: amount || transaction.amount,
        currency: transaction.currency,
        reasonCode,
        reason,
        responseDeadline,
      },
    });

    // Update transaction status
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: "ON_HOLD" },
    });

    // Create compliance alert
    await prisma.complianceAlert.create({
      data: {
        userId: transaction.senderId || transaction.receiverId || "",
        alertType: "CHARGEBACK",
        severity: "HIGH",
        title: "Chargeback Received",
        description: `Chargeback of ${transaction.currency} ${amount || transaction.amount} received for transaction ${transaction.referenceId}`,
        details: {
          chargebackId: chargeback.id,
          transactionId,
          reasonCode,
          reason,
        },
      },
    });

    // Notify merchant if applicable
    if (transaction.receiverId) {
      await prisma.notification.create({
        data: {
          userId: transaction.receiverId,
          type: "system",
          title: "Chargeback Alert",
          message: `You have received a chargeback for ${transaction.currency} ${amount || transaction.amount}. Please respond by ${responseDeadline.toLocaleDateString()}.`,
          data: { chargebackId: chargeback.id },
        },
      });
    }

    return NextResponse.json({ chargeback }, { status: 201 });
  } catch (error) {
    console.error("Create chargeback error:", error);
    return NextResponse.json({ error: "Failed to create chargeback" }, { status: 500 });
  }
}

// PUT - Submit representment evidence
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { chargebackId, evidence } = representmentSchema.parse(body);

    const chargeback = await prisma.chargeback.findUnique({
      where: { id: chargebackId },
    });

    if (!chargeback) {
      return NextResponse.json({ error: "Chargeback not found" }, { status: 404 });
    }

    if (chargeback.status !== "OPEN") {
      return NextResponse.json({ error: "Chargeback is no longer open for response" }, { status: 400 });
    }

    if (chargeback.responseDeadline && chargeback.responseDeadline < new Date()) {
      return NextResponse.json({ error: "Response deadline has passed" }, { status: 400 });
    }

    // Update with evidence
    const updated = await prisma.chargeback.update({
      where: { id: chargebackId },
      data: {
        status: "REPRESENTMENT",
        merchantEvidence: evidence,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "chargeback_representment",
        entityType: "chargeback",
        entityId: chargebackId,
        details: { evidence },
      },
    });

    return NextResponse.json({ chargeback: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Submit representment error:", error);
    return NextResponse.json({ error: "Failed to submit representment" }, { status: 500 });
  }
}

// PATCH - Resolve chargeback (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, resolution, status } = body;

    if (!id || !resolution || !status) {
      return NextResponse.json({ error: "ID, resolution, and status required" }, { status: 400 });
    }

    if (!["WON", "LOST", "ACCEPTED"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const chargeback = await prisma.chargeback.findUnique({
      where: { id },
    });

    if (!chargeback) {
      return NextResponse.json({ error: "Chargeback not found" }, { status: 404 });
    }

    const updated = await prisma.chargeback.update({
      where: { id },
      data: {
        status,
        resolution,
        resolvedAt: new Date(),
      },
    });

    // Update transaction status based on outcome
    const newTxStatus = status === "WON" ? "COMPLETED" : "REVERSED";
    await prisma.transaction.update({
      where: { id: chargeback.transactionId },
      data: { status: newTxStatus },
    });

    // If merchant lost, deduct chargeback fee and potentially reverse funds
    if (status === "LOST" || status === "ACCEPTED") {
      const transaction = await prisma.transaction.findUnique({
        where: { id: chargeback.transactionId },
      });

      if (transaction?.receiverId) {
        const wallet = await prisma.wallet.findFirst({
          where: { userId: transaction.receiverId, currency: chargeback.currency },
        });

        if (wallet) {
          const totalDeduction = Number(chargeback.amount) + Number(chargeback.chargebackFee);

          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { availableBalance: { decrement: totalDeduction } },
          });

          await prisma.ledgerEntry.create({
            data: {
              walletId: wallet.id,
              entryType: "debit",
              amount: totalDeduction,
              balanceBefore: wallet.availableBalance,
              balanceAfter: Number(wallet.availableBalance) - totalDeduction,
              description: `Chargeback loss + fee`,
              reference: chargeback.id,
            },
          });
        }
      }
    }

    return NextResponse.json({ chargeback: updated });
  } catch (error) {
    console.error("Resolve chargeback error:", error);
    return NextResponse.json({ error: "Failed to resolve chargeback" }, { status: 500 });
  }
}
