import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireRole,
  errorResponse,
  successResponse,
  prisma,
  generateReferenceId,
  calculateFee,
} from "@/lib/api-utils";

// GET /api/merchant/payouts - List payouts
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["VENDOR", "ADMIN", "SUPER_ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role?: string };
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const status = searchParams.get("status");

  // Get business
  const business = await prisma.business.findUnique({
    where: { userId: user.id },
  });

  if (!business && user.role === "VENDOR") {
    return errorResponse("Business profile not found", 404);
  }

  const where: Record<string, unknown> = {};

  if (user.role === "VENDOR") {
    where.businessId = business!.id;
  }

  if (status) {
    where.status = status;
  }

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: {
        business: {
          select: { legalName: true, tradingName: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payout.count({ where }),
  ]);

  return successResponse({
    payouts: payouts.map((p) => ({
      ...p,
      amount: Number(p.amount),
      fee: Number(p.fee),
      netAmount: Number(p.netAmount),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// POST /api/merchant/payouts - Request a payout
const createPayoutSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3).default("USD"),
  destinationType: z.enum(["bank_account", "wallet"]),
  destinationId: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireRole(["VENDOR"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role?: string };

  try {
    const body = await request.json();
    const data = createPayoutSchema.parse(body);

    // Get business
    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return errorResponse("Business profile not found", 404);
    }

    // Get wallet
    const wallet = await prisma.wallet.findFirst({
      where: { userId: user.id, currency: data.currency.toUpperCase() },
    });

    if (!wallet) {
      return errorResponse(`No ${data.currency} wallet found`, 404);
    }

    // Check available balance
    const availableBalance = Number(wallet.availableBalance);
    if (availableBalance < data.amount) {
      return errorResponse("Insufficient available balance", 400);
    }

    // Validate destination
    if (data.destinationType === "bank_account") {
      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: data.destinationId,
          userId: user.id,
          type: "BANK_ACCOUNT",
          status: "VERIFIED",
        },
      });

      if (!paymentMethod) {
        return errorResponse("Verified bank account not found", 404);
      }
    }

    const fee = calculateFee(data.amount, "PAYOUT");
    const netAmount = data.amount - fee;

    const referenceId = generateReferenceId("PYT");

    // Create payout
    const payout = await prisma.$transaction(async (tx) => {
      // Create payout record
      const newPayout = await tx.payout.create({
        data: {
          businessId: business.id,
          referenceId,
          status: "PENDING",
          amount: (data.amount),
          fee: (fee),
          netAmount: (netAmount),
          currency: data.currency.toUpperCase(),
          destinationType: data.destinationType,
          destinationId: data.destinationId,
          description: data.description,
        },
      });

      // Update wallet - move to pending
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          availableBalance: { decrement: data.amount },
          pendingBalance: { increment: data.amount },
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          referenceId: generateReferenceId("TXN"),
          type: "PAYOUT",
          status: "PENDING",
          senderId: user.id,
          walletId: wallet.id,
          amount: (data.amount),
          currency: data.currency.toUpperCase(),
          fee: (fee),
          netAmount: (netAmount),
          description: `Payout ${referenceId}`,
        },
      });

      return newPayout;
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "payout_requested",
        entityType: "payout",
        entityId: payout.id,
        details: {
          amount: data.amount,
          fee,
          netAmount,
          destinationType: data.destinationType,
        },
      },
    });

    return successResponse({
      id: payout.id,
      referenceId: payout.referenceId,
      status: payout.status,
      amount: Number(payout.amount),
      fee: Number(payout.fee),
      netAmount: Number(payout.netAmount),
      currency: payout.currency,
      message: "Payout requested. Processing typically takes 1-3 business days.",
      createdAt: payout.createdAt,
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Payout creation error:", error);
    return errorResponse("Failed to create payout", 500);
  }
}

// PATCH /api/merchant/payouts - Process payout (admin only)
const processPayoutSchema = z.object({
  payoutId: z.string(),
  action: z.enum(["approve", "reject", "complete"]),
  reason: z.string().optional(),
  externalRef: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role?: string };

  try {
    const body = await request.json();
    const data = processPayoutSchema.parse(body);

    const payout = await prisma.payout.findUnique({
      where: { id: data.payoutId },
      include: {
        business: {
          include: {
            user: {
              include: {
                wallets: {
                  where: { currency: undefined }, // Will filter below
                },
              },
            },
          },
        },
      },
    });

    if (!payout) {
      return errorResponse("Payout not found", 404);
    }

    const merchantWallet = await prisma.wallet.findFirst({
      where: { userId: payout.business.userId, currency: payout.currency },
    });

    if (data.action === "approve") {
      if (payout.status !== "PENDING") {
        return errorResponse("Only pending payouts can be approved", 400);
      }

      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: "PROCESSING" },
      });

      return successResponse({ success: true, message: "Payout approved for processing" });
    } else if (data.action === "complete") {
      if (payout.status !== "PROCESSING") {
        return errorResponse("Only processing payouts can be completed", 400);
      }

      await prisma.$transaction(async (tx) => {
        // Complete payout
        await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: "COMPLETED",
            processedAt: new Date(),
            externalRef: data.externalRef,
          },
        });

        // Update wallet
        if (merchantWallet) {
          await tx.wallet.update({
            where: { id: merchantWallet.id },
            data: {
              balance: { decrement: Number(payout.amount) },
              pendingBalance: { decrement: Number(payout.amount) },
            },
          });

          // Create ledger entry
          await tx.ledgerEntry.create({
            data: {
              walletId: merchantWallet.id,
              entryType: "debit",
              amount: payout.amount,
              balanceBefore: merchantWallet.balance,
              balanceAfter: (
                Number(merchantWallet.balance) - Number(payout.amount)
              ),
              description: `Payout ${payout.referenceId}`,
              reference: payout.referenceId,
            },
          });
        }

        // Update transaction
        await tx.transaction.updateMany({
          where: { description: `Payout ${payout.referenceId}` },
          data: { status: "COMPLETED", processedAt: new Date() },
        });
      });

      // Notify merchant
      await prisma.notification.create({
        data: {
          userId: payout.business.userId,
          type: "transaction",
          title: "Payout Completed",
          message: `Your payout of ${payout.currency} ${Number(payout.netAmount).toFixed(2)} has been processed.`,
        },
      });

      return successResponse({ success: true, message: "Payout completed" });
    } else if (data.action === "reject") {
      if (!["PENDING", "PROCESSING"].includes(payout.status)) {
        return errorResponse("Cannot reject this payout", 400);
      }

      await prisma.$transaction(async (tx) => {
        // Reject payout
        await tx.payout.update({
          where: { id: payout.id },
          data: {
            status: "FAILED",
            failureReason: data.reason || "Rejected by admin",
          },
        });

        // Restore wallet balance
        if (merchantWallet) {
          await tx.wallet.update({
            where: { id: merchantWallet.id },
            data: {
              availableBalance: { increment: Number(payout.amount) },
              pendingBalance: { decrement: Number(payout.amount) },
            },
          });
        }

        // Update transaction
        await tx.transaction.updateMany({
          where: { description: `Payout ${payout.referenceId}` },
          data: {
            status: "FAILED",
            failureReason: data.reason || "Rejected by admin",
          },
        });
      });

      // Notify merchant
      await prisma.notification.create({
        data: {
          userId: payout.business.userId,
          type: "system",
          title: "Payout Rejected",
          message: `Your payout request was rejected. ${data.reason || ""}`,
        },
      });

      return successResponse({ success: true, message: "Payout rejected" });
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Payout processing error:", error);
    return errorResponse("Failed to process payout", 500);
  }
}
