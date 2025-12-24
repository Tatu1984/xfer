import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/transactions - List transactions for current user
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };
  const searchParams = request.nextUrl.searchParams;

  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: Record<string, unknown> = {
    OR: [{ senderId: user.id }, { receiverId: user.id }],
  };

  if (type) {
    where.type = type;
  }
  if (status) {
    where.status = status;
  }
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
    }
    if (endDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }
  }

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        sender: {
          select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
        },
        receiver: {
          select: { id: true, email: true, displayName: true, firstName: true, lastName: true },
        },
        wallet: {
          select: { id: true, currency: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return successResponse({
    transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// POST /api/transactions - Create a transaction (internal use)
const createTransactionSchema = z.object({
  type: z.enum([
    "DEPOSIT",
    "WITHDRAWAL",
    "TRANSFER_IN",
    "TRANSFER_OUT",
    "PAYMENT",
    "REFUND",
    "PAYOUT",
    "FEE",
    "ADJUSTMENT",
    "HOLD",
    "RELEASE",
  ]),
  amount: z.number().positive(),
  currency: z.string().length(3),
  walletId: z.string(),
  receiverId: z.string().optional(),
  description: z.string().optional(),
  note: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const data = createTransactionSchema.parse(body);

    // Verify wallet ownership
    const wallet = await prisma.wallet.findFirst({
      where: { id: data.walletId, userId: user.id },
    });

    if (!wallet) {
      return errorResponse("Wallet not found", 404);
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        type: data.type,
        status: "PENDING",
        senderId: user.id,
        receiverId: data.receiverId,
        walletId: data.walletId,
        amount: data.amount,
        currency: data.currency,
        fee: 0,
        netAmount: data.amount,
        description: data.description,
        note: data.note,
        metadata: data.metadata as object | undefined,
      },
      include: {
        sender: {
          select: { id: true, email: true, displayName: true },
        },
        receiver: {
          select: { id: true, email: true, displayName: true },
        },
      },
    });

    return successResponse(transaction, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Transaction creation error:", error);
    return errorResponse("Failed to create transaction", 500);
  }
}
