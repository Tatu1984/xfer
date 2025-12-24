import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {};
    if (status && status !== "all") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { createdBy: { email: { contains: search, mode: "insensitive" } } },
        { createdBy: { displayName: { contains: search, mode: "insensitive" } } },
        { transaction: { referenceId: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where,
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
              sender: {
                select: {
                  email: true,
                  displayName: true,
                },
              },
              receiver: {
                select: {
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
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dispute.count({ where }),
    ]);

    return successResponse({
      disputes: disputes.map((d) => ({
        ...d,
        amount: Number(d.amount),
        refundAmount: d.refundAmount ? Number(d.refundAmount) : null,
        transaction: d.transaction
          ? {
              ...d.transaction,
              amount: Number(d.transaction.amount),
            }
          : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin get disputes error:", error);
    return errorResponse("Failed to fetch disputes", 500);
  }
}

const updateSchema = z.object({
  disputeId: z.string(),
  status: z.enum(["UNDER_REVIEW", "RESOLVED_BUYER_FAVOR", "RESOLVED_SELLER_FAVOR", "CLOSED"]).optional(),
  resolution: z.string().optional(),
  refundAmount: z.number().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    const dispute = await prisma.dispute.findUnique({
      where: { id: validated.disputeId },
    });

    if (!dispute) {
      return errorResponse("Dispute not found", 404);
    }

    const updateData: Record<string, unknown> = {};
    if (validated.status) {
      updateData.status = validated.status;
    }
    if (validated.resolution) {
      updateData.resolution = validated.resolution;
    }
    if (validated.refundAmount !== undefined) {
      updateData.refundAmount = validated.refundAmount;
    }
    if (validated.status && validated.status !== "UNDER_REVIEW") {
      updateData.resolvedAt = new Date();
      updateData.resolvedBy = authResult.id;
    }

    const updatedDispute = await prisma.dispute.update({
      where: { id: validated.disputeId },
      data: updateData,
      include: {
        createdBy: {
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
          },
        },
      },
    });

    // Create activity log
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "dispute_updated",
        entityType: "dispute",
        entityId: validated.disputeId,
        details: { status: validated.status, resolution: validated.resolution },
        ipAddress: request.headers.get("x-forwarded-for") || "unknown",
        userAgent: request.headers.get("user-agent") || "unknown",
      },
    });

    return successResponse({
      dispute: {
        ...updatedDispute,
        amount: Number(updatedDispute.amount),
        refundAmount: updatedDispute.refundAmount ? Number(updatedDispute.refundAmount) : null,
        transaction: updatedDispute.transaction
          ? {
              ...updatedDispute.transaction,
              amount: Number(updatedDispute.transaction.amount),
            }
          : null,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Admin update dispute error:", error);
    return errorResponse("Failed to update dispute", 500);
  }
}
