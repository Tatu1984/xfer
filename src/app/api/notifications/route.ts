import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: authResult.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          data: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: {
          userId: authResult.id,
          isRead: false,
        },
      }),
    ]);

    return successResponse({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    return errorResponse("Failed to fetch notifications", 500);
  }
}
