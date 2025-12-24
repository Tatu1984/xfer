import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    // Get vendor's business
    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return errorResponse("Business not found", 404);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Record<string, unknown> = {
      merchantId: business.id,
    };

    if (status && status !== "all") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return successResponse({
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        subtotal: order.subtotal,
        tax: order.tax,
        currency: order.currency,
        customerEmail: order.customerEmail,
        shippingAddress: order.shippingAddress,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items,
        metadata: order.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Vendor get orders error:", error);
    return errorResponse("Failed to fetch orders", 500);
  }
}
