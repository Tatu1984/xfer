import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { generateReferenceId } from "@/lib/api-utils";
import { sendWebhook, WebhookEvents } from "@/lib/webhooks";

const refundSchema = z.object({
  transactionId: z.string(),
  amount: z.number().positive().optional(), // If not provided, full refund
  reason: z.string().max(500).optional(),
});

// POST /api/refunds - Create a refund
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string; role?: string };

  try {
    const body = await request.json();
    const { transactionId, amount: requestedAmount, reason } = refundSchema.parse(body);

    // Get original transaction
    const originalTx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        sender: true,
        receiver: true,
        wallet: true,
      },
    });

    if (!originalTx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Check if user can refund (must be receiver/merchant or admin)
    const isReceiver = originalTx.receiverId === user.id;
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

    if (!isReceiver && !isAdmin) {
      return NextResponse.json(
        { error: "You can only refund transactions you received" },
        { status: 403 }
      );
    }

    // Check if transaction can be refunded
    if (originalTx.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Only completed transactions can be refunded" },
        { status: 400 }
      );
    }

    if (originalTx.type === "REFUND") {
      return NextResponse.json(
        { error: "Cannot refund a refund transaction" },
        { status: 400 }
      );
    }

    // Calculate refund amount
    const originalAmount = Number(originalTx.amount);

    // Get already refunded amount
    const existingRefunds = await prisma.transaction.aggregate({
      where: {
        type: "REFUND",
        metadata: {
          path: ["originalTransactionId"],
          equals: transactionId,
        },
        status: "COMPLETED",
      },
      _sum: { amount: true },
    });

    const alreadyRefunded = Number(existingRefunds._sum.amount || 0);
    const refundableAmount = originalAmount - alreadyRefunded;

    if (refundableAmount <= 0) {
      return NextResponse.json(
        { error: "Transaction has already been fully refunded" },
        { status: 400 }
      );
    }

    const refundAmount = requestedAmount
      ? Math.min(requestedAmount, refundableAmount)
      : refundableAmount;

    if (refundAmount <= 0) {
      return NextResponse.json(
        { error: "Invalid refund amount" },
        { status: 400 }
      );
    }

    // Get receiver's wallet (source of refund)
    const receiverWallet = await prisma.wallet.findFirst({
      where: {
        userId: originalTx.receiverId!,
        currency: originalTx.currency,
        isActive: true,
      },
    });

    if (!receiverWallet) {
      return NextResponse.json(
        { error: "Receiver wallet not found" },
        { status: 400 }
      );
    }

    // Check receiver has enough balance
    if (Number(receiverWallet.availableBalance) < refundAmount) {
      return NextResponse.json(
        { error: "Insufficient balance to process refund" },
        { status: 400 }
      );
    }

    // Get or create sender's wallet (destination of refund)
    let senderWallet = await prisma.wallet.findFirst({
      where: {
        userId: originalTx.senderId!,
        currency: originalTx.currency,
        isActive: true,
      },
    });

    if (!senderWallet && originalTx.senderId) {
      senderWallet = await prisma.wallet.create({
        data: {
          userId: originalTx.senderId,
          currency: originalTx.currency,
          balance: 0,
          availableBalance: 0,
          pendingBalance: 0,
        },
      });
    }

    const referenceId = generateReferenceId("RFN");

    // Execute refund in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create refund transaction
      const refundTx = await tx.transaction.create({
        data: {
          referenceId,
          type: "REFUND",
          status: "COMPLETED",
          senderId: originalTx.receiverId,
          receiverId: originalTx.senderId,
          walletId: receiverWallet.id,
          amount: refundAmount,
          currency: originalTx.currency,
          fee: 0, // No fee on refunds
          netAmount: refundAmount,
          description: `Refund for ${originalTx.referenceId}`,
          note: reason,
          metadata: {
            originalTransactionId: transactionId,
            originalReferenceId: originalTx.referenceId,
            reason,
          },
          processedAt: new Date(),
        },
      });

      // Deduct from receiver's wallet
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: {
          balance: { decrement: refundAmount },
          availableBalance: { decrement: refundAmount },
        },
      });

      // Add to sender's wallet
      if (senderWallet) {
        await tx.wallet.update({
          where: { id: senderWallet.id },
          data: {
            balance: { increment: refundAmount },
            availableBalance: { increment: refundAmount },
          },
        });
      }

      // Create ledger entries
      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId: receiverWallet.id,
            transactionId: refundTx.id,
            entryType: "debit",
            amount: refundAmount,
            balanceBefore: receiverWallet.balance,
            balanceAfter: Number(receiverWallet.balance) - refundAmount,
            description: `Refund issued for ${originalTx.referenceId}`,
            reference: referenceId,
          },
          ...(senderWallet
            ? [
                {
                  walletId: senderWallet.id,
                  transactionId: refundTx.id,
                  entryType: "credit" as const,
                  amount: refundAmount,
                  balanceBefore: senderWallet.balance,
                  balanceAfter: Number(senderWallet.balance) + refundAmount,
                  description: `Refund received for ${originalTx.referenceId}`,
                  reference: referenceId,
                },
              ]
            : []),
        ],
      });

      // Update original transaction status if fully refunded
      const totalRefunded = alreadyRefunded + refundAmount;
      if (totalRefunded >= originalAmount) {
        await tx.transaction.update({
          where: { id: transactionId },
          data: { status: "REVERSED" },
        });
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "refund_issued",
          entityType: "transaction",
          entityId: refundTx.id,
          details: {
            originalTransactionId: transactionId,
            amount: refundAmount,
            reason,
          },
        },
      });

      return refundTx;
    });

    // Create notifications
    await Promise.all([
      prisma.notification.create({
        data: {
          userId: originalTx.senderId!,
          type: "transaction",
          title: "Refund Received",
          message: `You received a refund of ${originalTx.currency} ${refundAmount.toFixed(2)}`,
          data: { transactionId: result.id },
        },
      }),
      prisma.notification.create({
        data: {
          userId: originalTx.receiverId!,
          type: "transaction",
          title: "Refund Issued",
          message: `Refund of ${originalTx.currency} ${refundAmount.toFixed(2)} has been processed`,
          data: { transactionId: result.id },
        },
      }),
    ]);

    // Send webhook
    await sendWebhook(WebhookEvents.TRANSACTION_REFUNDED, {
      transactionId: result.id,
      referenceId: result.referenceId,
      originalTransactionId: transactionId,
      amount: refundAmount,
      currency: originalTx.currency,
    });

    return NextResponse.json({
      success: true,
      refund: {
        id: result.id,
        referenceId: result.referenceId,
        amount: refundAmount,
        currency: originalTx.currency,
        status: result.status,
        originalTransactionId: transactionId,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
}

// GET /api/refunds - Get refunds for a transaction
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("transactionId");

    if (!transactionId) {
      return NextResponse.json({ error: "Transaction ID is required" }, { status: 400 });
    }

    const refunds = await prisma.transaction.findMany({
      where: {
        type: "REFUND",
        metadata: {
          path: ["originalTransactionId"],
          equals: transactionId,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const totalRefunded = refunds.reduce((sum, r) => sum + Number(r.amount), 0);

    return NextResponse.json({
      refunds,
      totalRefunded,
    });
  } catch (error) {
    console.error("Get refunds error:", error);
    return NextResponse.json({ error: "Failed to fetch refunds" }, { status: 500 });
  }
}
