import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/wallet - Get user's wallets
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };
  const searchParams = request.nextUrl.searchParams;
  const currency = searchParams.get("currency");

  const where: Record<string, unknown> = { userId: user.id, isActive: true };
  if (currency) {
    where.currency = currency.toUpperCase();
  }

  const wallets = await prisma.wallet.findMany({
    where,
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  // Calculate totals
  const totals = wallets.reduce(
    (acc, wallet) => ({
      totalBalance: acc.totalBalance + Number(wallet.balance),
      availableBalance: acc.availableBalance + Number(wallet.availableBalance),
      pendingBalance: acc.pendingBalance + Number(wallet.pendingBalance),
      reservedBalance: acc.reservedBalance + Number(wallet.reservedBalance),
    }),
    { totalBalance: 0, availableBalance: 0, pendingBalance: 0, reservedBalance: 0 }
  );

  return successResponse({
    wallets: wallets.map((w) => ({
      ...w,
      balance: Number(w.balance),
      availableBalance: Number(w.availableBalance),
      pendingBalance: Number(w.pendingBalance),
      reservedBalance: Number(w.reservedBalance),
    })),
    totals,
    defaultCurrency: wallets.find((w) => w.isDefault)?.currency || "USD",
  });
}

// POST /api/wallet - Create a new wallet
const createWalletSchema = z.object({
  currency: z.string().length(3).transform((v) => v.toUpperCase()),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const data = createWalletSchema.parse(body);

    // Check if currency is supported
    const currency = await prisma.currency.findUnique({
      where: { code: data.currency },
    });

    if (!currency || !currency.isActive) {
      return errorResponse("Currency not supported", 400);
    }

    // Check if wallet already exists
    const existing = await prisma.wallet.findFirst({
      where: { userId: user.id, currency: data.currency },
    });

    if (existing) {
      if (existing.isActive) {
        return errorResponse("Wallet already exists for this currency", 400);
      }
      // Reactivate existing wallet
      const wallet = await prisma.wallet.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
      return successResponse(wallet);
    }

    // Check if this is the first wallet (make it default)
    const walletCount = await prisma.wallet.count({
      where: { userId: user.id, isActive: true },
    });

    const wallet = await prisma.wallet.create({
      data: {
        userId: user.id,
        currency: data.currency,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        isDefault: walletCount === 0,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "wallet_created",
        entityType: "wallet",
        entityId: wallet.id,
        details: { currency: data.currency },
      },
    });

    return successResponse(wallet, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Wallet creation error:", error);
    return errorResponse("Failed to create wallet", 500);
  }
}
