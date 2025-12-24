import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { generateReferenceId } from "@/lib/api-utils";

// POST /api/transfers/[id]/cancel - Cancel a pending transfer
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };
  const { id: transactionId } = await params;

  try {
    // Get the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        wallet: true,
      },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    // Verify user is the sender
    if (transaction.senderId !== user.id) {
      return NextResponse.json(
        { error: "You can only cancel your own transfers" },
        { status: 403 }
      );
    }

    // Check if transaction can be cancelled
    // Only pending transactions can be cancelled
    if (transaction.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot cancel a ${transaction.status.toLowerCase()} transaction` },
        { status: 400 }
      );
    }

    // Check if within cancellation window (e.g., 30 minutes)
    const cancellationWindowMs = 30 * 60 * 1000; // 30 minutes
    const timeSinceCreation = Date.now() - transaction.createdAt.getTime();

    if (timeSinceCreation > cancellationWindowMs) {
      return NextResponse.json(
        { error: "Cancellation window has expired" },
        { status: 400 }
      );
    }

    const amount = Number(transaction.amount);
    const referenceId = generateReferenceId("CXL");

    // Execute cancellation in a transaction
    await prisma.$transaction(async (tx) => {
      // Update transaction status
      await tx.transaction.update({
        where: { id: transactionId },
        data: { status: "CANCELLED" },
      });

      // Refund amount to sender's wallet
      await tx.wallet.update({
        where: { id: transaction.walletId },
        data: {
          balance: { increment: amount },
          availableBalance: { increment: amount },
        },
      });

      // Create reversal ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: transaction.walletId,
          transactionId: transaction.id,
          entryType: "credit",
          amount: amount,
          balanceBefore: transaction.wallet.balance,
          balanceAfter: Number(transaction.wallet.balance) + amount,
          description: `Cancelled transfer: ${transaction.referenceId}`,
          reference: referenceId,
        },
      });

      // If receiver wallet was credited, reverse it
      if (transaction.receiverId) {
        const receiverWallet = await tx.wallet.findFirst({
          where: {
            userId: transaction.receiverId,
            currency: transaction.currency,
            isActive: true,
          },
        });

        if (receiverWallet && Number(receiverWallet.pendingBalance) >= amount) {
          await tx.wallet.update({
            where: { id: receiverWallet.id },
            data: {
              pendingBalance: { decrement: amount },
            },
          });
        }
      }

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "transfer_cancelled",
          entityType: "transaction",
          entityId: transactionId,
          details: {
            originalReferenceId: transaction.referenceId,
            amount,
            currency: transaction.currency,
          },
        },
      });
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "transaction",
        title: "Transfer Cancelled",
        message: `Your transfer of ${transaction.currency} ${amount.toFixed(2)} has been cancelled and refunded.`,
        data: { transactionId },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Transfer cancelled successfully",
      refundedAmount: amount,
      currency: transaction.currency,
    });
  } catch (error) {
    console.error("Cancel transfer error:", error);
    return NextResponse.json({ error: "Failed to cancel transfer" }, { status: 500 });
  }
}
