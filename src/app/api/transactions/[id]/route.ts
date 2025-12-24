import { NextRequest } from "next/server";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/transactions/[id] - Get single transaction
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

  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      OR: [{ senderId: user.id }, { receiverId: user.id }],
    },
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      receiver: {
        select: {
          id: true,
          email: true,
          displayName: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
      wallet: {
        select: { id: true, currency: true },
      },
      ledgerEntries: {
        orderBy: { createdAt: "desc" },
      },
      dispute: {
        select: {
          id: true,
          type: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });

  if (!transaction) {
    return errorResponse("Transaction not found", 404);
  }

  return successResponse(transaction);
}
