import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
  generateReferenceId,
  calculateFee,
  validateAmount,
} from "@/lib/api-utils";

// POST /api/transfers - Send money to another user
const transferSchema = z.object({
  recipientEmail: z.string().email("Invalid email address"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be 3 characters"),
  note: z.string().max(500).optional(),
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; email: string; name?: string };

  try {
    const body = await request.json();
    const data = transferSchema.parse(body);

    // Validate amount
    const amountValidation = validateAmount(data.amount);
    if (!amountValidation.valid) {
      return errorResponse(amountValidation.error!, 400);
    }

    // Check idempotency
    if (data.idempotencyKey) {
      const existing = await prisma.transaction.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        return successResponse(existing);
      }
    }

    // Find recipient
    const recipient = await prisma.user.findUnique({
      where: { email: data.recipientEmail.toLowerCase() },
      include: {
        wallets: {
          where: { currency: data.currency, isActive: true },
        },
      },
    });

    if (!recipient) {
      return errorResponse("Recipient not found", 404);
    }

    if (recipient.id === user.id) {
      return errorResponse("Cannot send money to yourself", 400);
    }

    if (recipient.status !== "ACTIVE") {
      return errorResponse("Recipient account is not active", 400);
    }

    // Get sender's wallet
    const senderWallet = await prisma.wallet.findFirst({
      where: { userId: user.id, currency: data.currency, isActive: true },
    });

    if (!senderWallet) {
      return errorResponse(`No ${data.currency} wallet found`, 404);
    }

    // Check balance
    const availableBalance = Number(senderWallet.availableBalance);
    if (availableBalance < data.amount) {
      return errorResponse("Insufficient balance", 400);
    }

    // Get or create recipient wallet
    let recipientWallet = recipient.wallets[0];
    if (!recipientWallet) {
      recipientWallet = await prisma.wallet.create({
        data: {
          userId: recipient.id,
          currency: data.currency,
          balance: 0,
          availableBalance: 0,
          pendingBalance: 0,
          isDefault: recipient.wallets.length === 0,
        },
      });
    }

    const fee = calculateFee(data.amount, "TRANSFER_OUT");
    const netAmount = data.amount - fee;
    const referenceId = generateReferenceId("TFR");

    // Execute transfer in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create outgoing transaction (sender)
      const outgoingTx = await tx.transaction.create({
        data: {
          referenceId,
          idempotencyKey: data.idempotencyKey,
          type: "TRANSFER_OUT",
          status: "COMPLETED",
          senderId: user.id,
          receiverId: recipient.id,
          walletId: senderWallet.id,
          amount: (data.amount),
          currency: data.currency,
          fee: (fee),
          netAmount: (netAmount),
          description: `Transfer to ${recipient.displayName || recipient.email}`,
          note: data.note,
          processedAt: new Date(),
        },
      });

      // Create incoming transaction (recipient)
      await tx.transaction.create({
        data: {
          referenceId: generateReferenceId("TFR"),
          type: "TRANSFER_IN",
          status: "COMPLETED",
          senderId: user.id,
          receiverId: recipient.id,
          walletId: recipientWallet.id,
          amount: (netAmount),
          currency: data.currency,
          fee: (0),
          netAmount: (netAmount),
          description: `Transfer from ${user.name || user.email}`,
          note: data.note,
          processedAt: new Date(),
        },
      });

      // Update sender wallet
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: {
          balance: { decrement: data.amount },
          availableBalance: { decrement: data.amount },
        },
      });

      // Create sender ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: senderWallet.id,
          transactionId: outgoingTx.id,
          entryType: "debit",
          amount: (data.amount),
          balanceBefore: senderWallet.balance,
          balanceAfter: (Number(senderWallet.balance) - data.amount),
          description: `Transfer to ${recipient.email}`,
          reference: referenceId,
        },
      });

      // Update recipient wallet
      await tx.wallet.update({
        where: { id: recipientWallet.id },
        data: {
          balance: { increment: netAmount },
          availableBalance: { increment: netAmount },
        },
      });

      // Create recipient ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: recipientWallet.id,
          transactionId: outgoingTx.id,
          entryType: "credit",
          amount: (netAmount),
          balanceBefore: recipientWallet.balance,
          balanceAfter: (Number(recipientWallet.balance) + netAmount),
          description: `Transfer from ${user.email}`,
          reference: referenceId,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "transfer_sent",
          entityType: "transaction",
          entityId: outgoingTx.id,
          details: {
            recipientId: recipient.id,
            recipientEmail: recipient.email,
            amount: data.amount,
            currency: data.currency,
            fee,
          },
        },
      });

      return outgoingTx;
    });

    return successResponse({
      success: true,
      transaction: {
        id: result.id,
        referenceId: result.referenceId,
        amount: data.amount,
        fee,
        netAmount,
        currency: data.currency,
        recipient: {
          email: recipient.email,
          name: recipient.displayName || `${recipient.firstName} ${recipient.lastName}`.trim(),
        },
        status: result.status,
        createdAt: result.createdAt,
      },
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Transfer error:", error);
    return errorResponse("Failed to process transfer", 500);
  }
}
