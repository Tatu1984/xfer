import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    await prisma.notification.updateMany({
      where: {
        userId: authResult.id,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return successResponse({ success: true });
  } catch (error) {
    console.error("Mark all notifications as read error:", error);
    return errorResponse("Failed to mark notifications as read", 500);
  }
}
