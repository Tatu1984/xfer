import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";

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

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        userId: authResult.id,
      },
    });

    if (!notification) {
      return errorResponse("Notification not found", 404);
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Mark notification as read error:", error);
    return errorResponse("Failed to mark notification as read", 500);
  }
}
