import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

const messageSchema = z.object({
  content: z.string().min(1).max(2000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { id } = await params;
    const body = await request.json();
    const validated = messageSchema.parse(body);

    // Verify user has access to this dispute
    const dispute = await prisma.dispute.findFirst({
      where: {
        id,
        OR: [
          { createdById: authResult.id },
          { respondentId: authResult.id },
        ],
      },
    });

    if (!dispute) {
      return errorResponse("Dispute not found", 404);
    }

    if (dispute.status !== "OPEN" && dispute.status !== "UNDER_REVIEW" && dispute.status !== "ESCALATED") {
      return errorResponse("Cannot add messages to closed dispute", 400);
    }

    // Determine sender role
    const senderRole = dispute.createdById === authResult.id ? "buyer" : "seller";

    const message = await prisma.disputeMessage.create({
      data: {
        disputeId: id,
        senderId: authResult.id,
        senderRole,
        message: validated.content,
        attachments: [],
      },
    });

    return successResponse({ message }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Create message error:", error);
    return errorResponse("Failed to send message", 500);
  }
}

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

    // Verify user has access to this dispute
    const dispute = await prisma.dispute.findFirst({
      where: {
        id,
        OR: [
          { createdById: authResult.id },
          { respondentId: authResult.id },
        ],
      },
      include: {
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

    return successResponse({ messages: dispute.messages });
  } catch (error) {
    console.error("Get messages error:", error);
    return errorResponse("Failed to fetch messages", 500);
  }
}
