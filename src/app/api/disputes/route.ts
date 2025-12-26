import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  requireRole,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/disputes - List disputes
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role: string };
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const status = searchParams.get("status");

  const isAdmin = ["SUPER_ADMIN", "ADMIN"].includes(user.role);

  const where: Record<string, unknown> = {};

  if (!isAdmin) {
    // Regular users can only see their own disputes
    where.OR = [{ createdById: user.id }, { respondentId: user.id }];
  }

  if (status) {
    where.status = status;
  }

  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      where,
      include: {
        transaction: {
          select: {
            id: true,
            referenceId: true,
            type: true,
            amount: true,
            currency: true,
            createdAt: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            displayName: true,
            firstName: true,
            lastName: true,
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
        _count: {
          select: { messages: true },
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
        ? { ...d.transaction, amount: Number(d.transaction.amount) }
        : null,
      messageCount: d._count.messages,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// POST /api/disputes - Create a new dispute
const createDisputeSchema = z.object({
  transactionId: z.string(),
  type: z.enum([
    "ITEM_NOT_RECEIVED",
    "NOT_AS_DESCRIBED",
    "UNAUTHORIZED",
    "DUPLICATE",
    "SUBSCRIPTION_CANCELLED",
    "OTHER",
  ]),
  reason: z.string().min(10).max(1000),
  description: z.string().max(5000).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role: string };

  try {
    const body = await request.json();
    const data = createDisputeSchema.parse(body);

    // Get the transaction
    const transaction = await prisma.transaction.findFirst({
      where: {
        id: data.transactionId,
        OR: [{ senderId: user.id }, { receiverId: user.id }],
        status: "COMPLETED",
      },
    });

    if (!transaction) {
      return errorResponse("Transaction not found or not eligible for dispute", 404);
    }

    // Check if dispute already exists
    const existingDispute = await prisma.dispute.findUnique({
      where: { transactionId: data.transactionId },
    });

    if (existingDispute) {
      return errorResponse("A dispute already exists for this transaction", 400);
    }

    // Determine respondent
    const respondentId =
      transaction.senderId === user.id ? transaction.receiverId : transaction.senderId;

    // Create dispute
    const dispute = await prisma.dispute.create({
      data: {
        transactionId: data.transactionId,
        createdById: user.id,
        respondentId,
        type: data.type,
        status: "OPEN",
        amount: transaction.amount,
        currency: transaction.currency,
        reason: data.reason,
        description: data.description,
        sellerDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
      include: {
        transaction: {
          select: { id: true, referenceId: true, amount: true, currency: true },
        },
      },
    });

    // Create initial message
    await prisma.disputeMessage.create({
      data: {
        disputeId: dispute.id,
        senderId: user.id,
        senderRole: "buyer",
        message: data.reason + (data.description ? `\n\n${data.description}` : ""),
      },
    });

    // Update transaction status
    await prisma.transaction.update({
      where: { id: data.transactionId },
      data: { requiresReview: true },
    });

    // Notify respondent
    if (respondentId) {
      await prisma.notification.create({
        data: {
          userId: respondentId,
          type: "system",
          title: "New Dispute Filed",
          message: `A dispute has been filed for transaction ${transaction.referenceId}. Please respond within 7 days.`,
          data: { disputeId: dispute.id, transactionId: transaction.id },
        },
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "dispute_created",
        entityType: "dispute",
        entityId: dispute.id,
        details: {
          transactionId: data.transactionId,
          type: data.type,
          amount: Number(transaction.amount),
        },
      },
    });

    return successResponse({
      id: dispute.id,
      status: dispute.status,
      type: dispute.type,
      amount: Number(dispute.amount),
      currency: dispute.currency,
      sellerDeadline: dispute.sellerDeadline,
      message: "Dispute created successfully. The seller has 7 days to respond.",
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Dispute creation error:", error);
    return errorResponse("Failed to create dispute", 500);
  }
}

// PATCH /api/disputes - Update dispute (respond, escalate, resolve)
const updateDisputeSchema = z.object({
  disputeId: z.string(),
  action: z.enum(["respond", "escalate", "resolve"]),
  // For respond
  message: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  // For resolve (admin only)
  resolution: z.enum(["buyer_favor", "seller_favor"]).optional(),
  refundAmount: z.number().optional(),
  resolutionNote: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role: string };

  try {
    const body = await request.json();
    const data = updateDisputeSchema.parse(body);

    const dispute = await prisma.dispute.findFirst({
      where: {
        id: data.disputeId,
        OR: [
          { createdById: user.id },
          { respondentId: user.id },
          // Admins can access all
          ...(["SUPER_ADMIN", "ADMIN"].includes(user.role)
            ? [{ id: data.disputeId }]
            : []),
        ],
      },
      include: {
        transaction: true,
      },
    });

    if (!dispute) {
      return errorResponse("Dispute not found", 404);
    }

    if (data.action === "respond") {
      if (!data.message) {
        return errorResponse("Message required", 400);
      }

      // Determine sender role
      const senderRole =
        dispute.createdById === user.id
          ? "buyer"
          : dispute.respondentId === user.id
          ? "seller"
          : "admin";

      // Add message
      await prisma.disputeMessage.create({
        data: {
          disputeId: dispute.id,
          senderId: user.id,
          senderRole,
          message: data.message,
          attachments: data.evidence || [],
        },
      });

      // Update evidence if seller responding
      if (senderRole === "seller") {
        await prisma.dispute.update({
          where: { id: dispute.id },
          data: {
            status: "UNDER_REVIEW",
            sellerEvidence: {
              ...(dispute.sellerEvidence as object || {}),
              response: data.message,
              attachments: data.evidence,
              respondedAt: new Date(),
            },
          },
        });
      }

      return successResponse({ success: true, message: "Response added" });
    } else if (data.action === "escalate") {
      if (dispute.status === "ESCALATED") {
        return errorResponse("Dispute already escalated", 400);
      }

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: "ESCALATED",
          escalationDate: new Date(),
        },
      });

      return successResponse({ success: true, message: "Dispute escalated to admin" });
    } else if (data.action === "resolve") {
      // Only admins can resolve
      const adminCheck = await requireRole(["SUPER_ADMIN", "ADMIN"]);
      if ("error" in adminCheck) {
        return errorResponse("Only admins can resolve disputes", 403);
      }

      if (!data.resolution) {
        return errorResponse("Resolution required", 400);
      }

      const newStatus =
        data.resolution === "buyer_favor"
          ? "RESOLVED_BUYER_FAVOR"
          : "RESOLVED_SELLER_FAVOR";

      const refundAmount = data.refundAmount || 0;

      await prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: newStatus,
          resolvedAt: new Date(),
          resolvedBy: user.id,
          resolution: data.resolutionNote,
          refundAmount: refundAmount > 0 ? refundAmount : null,
        },
      });

      // TODO: Process refund if buyer_favor and refundAmount > 0

      // Notify both parties
      const notifications: { userId: string; type: string; title: string; message: string }[] = [];
      if (dispute.createdById) {
        notifications.push({
          userId: dispute.createdById,
          type: "system" as const,
          title: "Dispute Resolved",
          message: `Your dispute has been resolved ${
            data.resolution === "buyer_favor" ? "in your favor" : "in the seller's favor"
          }.`,
        });
      }
      if (dispute.respondentId) {
        notifications.push({
          userId: dispute.respondentId,
          type: "system" as const,
          title: "Dispute Resolved",
          message: `The dispute has been resolved ${
            data.resolution === "seller_favor" ? "in your favor" : "in the buyer's favor"
          }.`,
        });
      }

      if (notifications.length > 0) {
        await prisma.notification.createMany({ data: notifications });
      }

      return successResponse({
        success: true,
        message: "Dispute resolved",
        status: newStatus,
      });
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Dispute update error:", error);
    return errorResponse("Failed to update dispute", 500);
  }
}
