import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { id } = await params;

    const dispute = await prisma.dispute.findFirst({
      where: {
        id,
        OR: [
          { createdById: authResult.id },
          { respondentId: authResult.id },
        ],
      },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        respondent: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        transaction: {
          select: {
            id: true,
            referenceId: true,
            amount: true,
            currency: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            message: true,
            senderRole: true,
            senderId: true,
            attachments: true,
            createdAt: true,
          },
        },
      },
    });

    if (!dispute) {
      return errorResponse("Dispute not found", 404);
    }

    return successResponse({
      dispute: {
        ...dispute,
        amount: Number(dispute.amount),
        refundAmount: dispute.refundAmount ? Number(dispute.refundAmount) : null,
        transaction: dispute.transaction
          ? {
              ...dispute.transaction,
              amount: Number(dispute.transaction.amount),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get dispute error:", error);
    return errorResponse("Failed to fetch dispute", 500);
  }
}
