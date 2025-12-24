import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/wallet/[id] - Get single wallet with ledger entries
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };
  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;
  const includeLedger = searchParams.get("ledger") === "true";
  const ledgerLimit = Math.min(parseInt(searchParams.get("ledgerLimit") || "50"), 100);

  const wallet = await prisma.wallet.findFirst({
    where: { id, userId: user.id },
    include: includeLedger
      ? {
          ledgerEntries: {
            orderBy: { createdAt: "desc" },
            take: ledgerLimit,
            include: {
              transaction: {
                select: {
                  id: true,
                  referenceId: true,
                  type: true,
                  status: true,
                  description: true,
                },
              },
            },
          },
        }
      : undefined,
  });

  if (!wallet) {
    return errorResponse("Wallet not found", 404);
  }

  return successResponse({
    ...wallet,
    balance: Number(wallet.balance),
    availableBalance: Number(wallet.availableBalance),
    pendingBalance: Number(wallet.pendingBalance),
    reservedBalance: Number(wallet.reservedBalance),
  });
}

// PATCH /api/wallet/[id] - Update wallet (set default)
const updateWalletSchema = z.object({
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };
  const { id } = await params;

  try {
    const body = await request.json();
    const data = updateWalletSchema.parse(body);

    const wallet = await prisma.wallet.findFirst({
      where: { id, userId: user.id, isActive: true },
    });

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.wallet.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.wallet.update({
      where: { id },
      data,
    });

    return successResponse(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    return errorResponse("Failed to update wallet", 500);
  }
}
