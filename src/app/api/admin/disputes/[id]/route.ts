import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { id } = await params;

    const dispute = await prisma.dispute.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
            createdAt: true,
          },
        },
        respondent: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
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
            sender: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
            receiver: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
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

    // If resolvedBy is set, fetch the resolver user info
    let resolvedByUser: { id: string; email: string; displayName: string | null } | null = null;
    if (dispute.resolvedBy) {
      resolvedByUser = await prisma.user.findUnique({
        where: { id: dispute.resolvedBy },
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      });
    }

    return successResponse({
      dispute: {
        ...dispute,
        amount: Number(dispute.amount),
        refundAmount: dispute.refundAmount ? Number(dispute.refundAmount) : null,
        resolvedByUser,
        transaction: dispute.transaction
          ? {
              ...dispute.transaction,
              amount: Number(dispute.transaction.amount),
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Admin get dispute error:", error);
    return errorResponse("Failed to fetch dispute", 500);
  }
}
