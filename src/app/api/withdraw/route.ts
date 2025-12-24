import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, generateReferenceId, calculateFee } from "@/lib/api-utils";
import { sendTransactionEmail } from "@/lib/email";

const withdrawSchema = z.object({
  paymentMethodId: z.string(),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3).default("USD"),
});

// POST /api/withdraw - Withdraw funds to bank/card
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { paymentMethodId, amount, currency } = withdrawSchema.parse(body);

    // KYC required for withdrawals
    const kyc = await prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });

    if (!kyc || kyc.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Identity verification required for withdrawals" },
        { status: 403 }
      );
    }

    // Get payment method (must be bank account for withdrawals)
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: user.id, status: "VERIFIED" },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    if (paymentMethod.type !== "BANK_ACCOUNT") {
      return NextResponse.json(
        { error: "Withdrawals are only supported to bank accounts" },
        { status: 400 }
      );
    }

    // Get wallet
    const wallet = await prisma.wallet.findFirst({
      where: { userId: user.id, currency, isActive: true },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: `No ${currency} wallet found` },
        { status: 404 }
      );
    }

    // Check balance
    const fee = calculateFee(amount, "WITHDRAWAL");
    const totalDebit = amount + fee;

    if (Number(wallet.availableBalance) < totalDebit) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 400 }
      );
    }

    const referenceId = generateReferenceId("WTH");

    // Process withdrawal
    const result = await prisma.$transaction(async (tx) => {
      // Create withdrawal transaction (pending until processed)
      const transaction = await tx.transaction.create({
        data: {
          referenceId,
          type: "WITHDRAWAL",
          status: "PENDING",
          senderId: user.id,
          walletId: wallet.id,
          amount,
          currency,
          fee,
          netAmount: amount,
          description: `Withdrawal to bank account`,
          metadata: {
            paymentMethodId,
            bankLast4: paymentMethod.accountLast4,
          },
        },
      });

      // Deduct from wallet (move to pending)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: totalDebit },
          pendingBalance: { increment: totalDebit },
        },
      });

      // Create ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          entryType: "debit",
          amount: totalDebit,
          balanceBefore: wallet.availableBalance,
          balanceAfter: Number(wallet.availableBalance) - totalDebit,
          description: "Withdrawal initiated",
          reference: referenceId,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "withdrawal_initiated",
          entityType: "transaction",
          entityId: transaction.id,
          details: {
            amount,
            fee,
            currency,
          },
        },
      });

      return transaction;
    });

    // Send email notification
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, firstName: true },
    });

    if (dbUser) {
      await sendTransactionEmail(dbUser.email, {
        recipientName: dbUser.firstName || "Customer",
        amount: amount.toFixed(2),
        currency,
        type: "sent",
        referenceId,
        date: new Date().toLocaleDateString(),
        description: "Withdrawal to bank account - processing",
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "transaction",
        title: "Withdrawal Initiated",
        message: `Your withdrawal of ${currency} ${amount.toFixed(2)} is being processed. Funds will arrive in 1-3 business days.`,
        data: { transactionId: result.id },
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.id,
        referenceId: result.referenceId,
        amount,
        fee,
        currency,
        status: result.status,
        estimatedArrival: "1-3 business days",
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Withdrawal error:", error);
    return NextResponse.json({ error: "Failed to process withdrawal" }, { status: 500 });
  }
}

// GET /api/withdraw/history - Get withdrawal history
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    const withdrawals = await prisma.transaction.findMany({
      where: {
        senderId: user.id,
        type: "WITHDRAWAL",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error("Get withdrawals error:", error);
    return NextResponse.json({ error: "Failed to fetch withdrawals" }, { status: 500 });
  }
}
