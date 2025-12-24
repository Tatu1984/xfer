import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, generateReferenceId } from "@/lib/api-utils";
import { isSandboxMode, simulatePayment, simulateBankTransfer } from "@/lib/sandbox";
import { sendTransactionEmail } from "@/lib/email";

const fundSchema = z.object({
  paymentMethodId: z.string(),
  amount: z.number().positive("Amount must be positive").max(50000, "Maximum amount is $50,000"),
  currency: z.string().length(3).default("USD"),
});

// POST /api/funding - Add funds to wallet
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { paymentMethodId, amount, currency } = fundSchema.parse(body);

    // Get payment method
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: { id: paymentMethodId, userId: user.id, status: "VERIFIED" },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "Payment method not found" },
        { status: 404 }
      );
    }

    // Validate KYC for larger amounts
    if (amount > 1000) {
      const kyc = await prisma.kYCVerification.findUnique({
        where: { userId: user.id },
      });
      if (!kyc || kyc.status !== "APPROVED") {
        return NextResponse.json(
          { error: "Identity verification required for amounts over $1,000" },
          { status: 403 }
        );
      }
    }

    const referenceId = generateReferenceId("FND");

    // Process payment based on type
    let paymentResult: { success: boolean; transactionId?: string; error?: string };

    if (isSandboxMode()) {
      // Sandbox mode - simulate payment
      if (paymentMethod.type === "DEBIT_CARD" || paymentMethod.type === "CREDIT_CARD") {
        const cardNumber = paymentMethod.cardLast4 || "1111";
        paymentResult = await simulatePayment(`4111111111111${cardNumber}`, amount);
      } else {
        paymentResult = await simulateBankTransfer("110000000", "000123456789", amount);
      }
    } else {
      // Production - integrate with payment processor
      // This is where you'd integrate Stripe, Adyen, etc.
      paymentResult = {
        success: true,
        transactionId: `prod_${Date.now()}`,
      };
    }

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || "Payment failed" },
        { status: 400 }
      );
    }

    // Get or create wallet
    let wallet = await prisma.wallet.findFirst({
      where: { userId: user.id, currency, isActive: true },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId: user.id,
          currency,
          balance: 0,
          availableBalance: 0,
          pendingBalance: 0,
          isDefault: true,
        },
      });
    }

    // Create transaction and update wallet
    const result = await prisma.$transaction(async (tx) => {
      // Create deposit transaction
      const transaction = await tx.transaction.create({
        data: {
          referenceId,
          type: "DEPOSIT",
          status: "COMPLETED",
          receiverId: user.id,
          walletId: wallet.id,
          amount,
          currency,
          fee: 0,
          netAmount: amount,
          description: `Deposit from ${paymentMethod.type === "BANK_ACCOUNT" ? "bank account" : "card"}`,
          metadata: {
            paymentMethodId,
            processorTransactionId: paymentResult.transactionId,
            sandbox: isSandboxMode(),
          },
          processedAt: new Date(),
        },
      });

      // Update wallet balance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
          availableBalance: { increment: amount },
        },
      });

      // Create ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionId: transaction.id,
          entryType: "credit",
          amount,
          balanceBefore: wallet.balance,
          balanceAfter: Number(wallet.balance) + amount,
          description: "Funds added",
          reference: referenceId,
        },
      });

      // Log activity
      await tx.activityLog.create({
        data: {
          userId: user.id,
          action: "funds_added",
          entityType: "transaction",
          entityId: transaction.id,
          details: {
            amount,
            currency,
            paymentMethodType: paymentMethod.type,
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
        type: "received",
        referenceId,
        date: new Date().toLocaleDateString(),
        description: "Funds added to wallet",
      });
    }

    // Create notification
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "transaction",
        title: "Funds Added",
        message: `${currency} ${amount.toFixed(2)} has been added to your wallet`,
        data: { transactionId: result.id },
      },
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.id,
        referenceId: result.referenceId,
        amount,
        currency,
        status: result.status,
      },
      newBalance: Number(wallet.balance) + amount,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Funding error:", error);
    return NextResponse.json({ error: "Failed to add funds" }, { status: 500 });
  }
}

// GET /api/funding/methods - Get available funding methods
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { userId: user.id, status: "VERIFIED" },
      select: {
        id: true,
        type: true,
        isDefault: true,
        cardBrand: true,
        cardLast4: true,
        accountLast4: true,
        bankName: true,
        createdAt: true,
      },
      orderBy: { isDefault: "desc" },
    });

    // Get funding limits based on KYC status
    const kyc = await prisma.kYCVerification.findUnique({
      where: { userId: user.id },
    });

    const limits = {
      singleTransaction: kyc?.status === "APPROVED" ? 50000 : 1000,
      daily: kyc?.status === "APPROVED" ? 100000 : 2500,
      monthly: kyc?.status === "APPROVED" ? 500000 : 10000,
    };

    return NextResponse.json({
      methods: paymentMethods.map((pm) => ({
        id: pm.id,
        type: pm.type,
        isDefault: pm.isDefault,
        last4: pm.cardLast4 || pm.accountLast4,
        brand: pm.cardBrand,
        bankName: pm.bankName,
      })),
      limits,
      kycVerified: kyc?.status === "APPROVED",
    });
  } catch (error) {
    console.error("Get funding methods error:", error);
    return NextResponse.json({ error: "Failed to fetch funding methods" }, { status: 500 });
  }
}
