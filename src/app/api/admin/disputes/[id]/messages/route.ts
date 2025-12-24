import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
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
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { id } = await params;
    const body = await request.json();
    const validated = messageSchema.parse(body);

    const dispute = await prisma.dispute.findUnique({
      where: { id },
    });

    if (!dispute) {
      return errorResponse("Dispute not found", 404);
    }

    if (dispute.status !== "OPEN" && dispute.status !== "UNDER_REVIEW") {
      return errorResponse("Cannot add messages to closed dispute", 400);
    }

    const message = await prisma.disputeMessage.create({
      data: {
        disputeId: id,
        senderId: authResult.id,
        senderRole: "admin",
        message: validated.content,
        attachments: [],
      },
    });

    return successResponse({ message }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Admin create message error:", error);
    return errorResponse("Failed to send message", 500);
  }
}
