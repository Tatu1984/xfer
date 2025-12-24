import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    // Get vendor's business
    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return errorResponse("Business not found", 404);
    }

    // Get payouts
    const payouts = await prisma.payout.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Get vendor's wallet balance
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId: authResult.id,
        currency: "USD",
      },
    });

    // Get pending payout amount
    const pendingPayouts = await prisma.payout.aggregate({
      where: {
        businessId: business.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { amount: true },
    });

    // Get payment methods for payout
    const paymentMethods = await prisma.paymentMethod.findMany({
      where: {
        userId: authResult.id,
        type: "BANK_ACCOUNT",
        status: "VERIFIED",
      },
      select: {
        id: true,
        type: true,
        accountLast4: true,
        bankName: true,
        status: true,
      },
    });

    return successResponse({
      payouts: payouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        destinationType: p.destinationType,
        destinationDetails: p.destinationDetails,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
        description: p.description,
      })),
      balance: {
        available: wallet?.balance || 0,
        pending: pendingPayouts._sum.amount || 0,
        currency: wallet?.currency || "USD",
      },
      paymentMethods,
    });
  } catch (error) {
    console.error("Vendor get payouts error:", error);
    return errorResponse("Failed to fetch payouts", 500);
  }
}

const createPayoutSchema = z.object({
  amount: z.number().positive(),
  paymentMethodId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const body = await request.json();
    const validated = createPayoutSchema.parse(body);

    // Get vendor's business
    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return errorResponse("Business not found", 404);
    }

    // Verify payment method belongs to user
    const paymentMethod = await prisma.paymentMethod.findFirst({
      where: {
        id: validated.paymentMethodId,
        userId: authResult.id,
        type: "BANK_ACCOUNT",
        status: "VERIFIED",
      },
    });

    if (!paymentMethod) {
      return errorResponse("Invalid payment method", 400);
    }

    // Get vendor's wallet
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId: authResult.id,
        currency: "USD",
      },
    });

    if (!wallet || Number(wallet.balance) < validated.amount) {
      return errorResponse("Insufficient balance", 400);
    }

    // Create payout and deduct from wallet in transaction
    const payout = await prisma.$transaction(async (tx) => {
      // Deduct from wallet
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: validated.amount },
        },
      });

      // Create ledger entry
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          entryType: "DEBIT",
          amount: validated.amount,
          description: "Payout request",
          balanceBefore: Number(wallet.balance),
          balanceAfter: Number(wallet.balance) - validated.amount,
        },
      });

      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          businessId: business.id,
          referenceId: `PO${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
          amount: validated.amount,
          netAmount: validated.amount,
          currency: "USD",
          status: "PENDING",
          destinationType: "bank_account",
          destinationId: paymentMethod.id,
          destinationDetails: {
            bankName: paymentMethod.bankName,
            last4: paymentMethod.accountLast4,
          },
        },
      });

      return newPayout;
    });

    return successResponse({ payout }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Vendor create payout error:", error);
    return errorResponse("Failed to create payout", 500);
  }
}
