import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        status: "PENDING",
      },
      include: {
        merchant: {
          select: {
            tradingName: true,
            legalName: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse("Order not found or already processed", 404);
    }

    return successResponse({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: Number(order.total),
        subtotal: Number(order.subtotal),
        tax: Number(order.tax),
        shipping: Number(order.shipping),
        discount: Number(order.discount),
        currency: order.currency,
        items: order.items, // This is a JSON field
        merchant: {
          name: order.merchant.tradingName || order.merchant.legalName,
        },
      },
    });
  } catch (error) {
    console.error("Get checkout order error:", error);
    return errorResponse("Failed to fetch order", 500);
  }
}
