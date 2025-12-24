import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireRole,
  errorResponse,
  successResponse,
  prisma,
  generateReferenceId,
  calculateFee,
} from "@/lib/api-utils";

// GET /api/merchant/orders - List merchant orders
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["VENDOR", "ADMIN", "SUPER_ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role: string };
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const status = searchParams.get("status");

  // Get merchant's business
  const business = await prisma.business.findUnique({
    where: { userId: user.id },
  });

  if (!business && user.role === "VENDOR") {
    return errorResponse("Business profile not found", 404);
  }

  const where: Record<string, unknown> = {};

  if (user.role === "VENDOR") {
    where.merchantId = business!.id;
  }

  if (status) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        transactions: {
          select: {
            id: true,
            status: true,
            amount: true,
            processedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where }),
  ]);

  return successResponse({
    orders: orders.map((o) => ({
      ...o,
      subtotal: Number(o.subtotal),
      tax: Number(o.tax),
      shipping: Number(o.shipping),
      discount: Number(o.discount),
      total: Number(o.total),
      authorizedAmount: o.authorizedAmount ? Number(o.authorizedAmount) : null,
      capturedAmount: o.capturedAmount ? Number(o.capturedAmount) : null,
      refundedAmount: o.refundedAmount ? Number(o.refundedAmount) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// POST /api/merchant/orders - Create an order (checkout)
const createOrderSchema = z.object({
  items: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      sku: z.string().optional(),
    })
  ).min(1),
  currency: z.string().length(3).default("USD"),
  tax: z.number().min(0).default(0),
  shipping: z.number().min(0).default(0),
  discount: z.number().min(0).default(0),
  customerEmail: z.string().email(),
  customerPhone: z.string().optional(),
  shippingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string().optional(),
    postalCode: z.string(),
    country: z.string().length(2),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireRole(["VENDOR"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role: string };

  try {
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    // Get merchant's business
    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return errorResponse("Business profile not found", 404);
    }

    // Calculate totals
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    const total = subtotal + data.tax + data.shipping - data.discount;

    const orderNumber = generateReferenceId("ORD");

    const order = await prisma.order.create({
      data: {
        orderNumber,
        merchantId: business.id,
        status: "PENDING",
        items: data.items,
        subtotal,
        tax: data.tax,
        shipping: data.shipping,
        discount: data.discount,
        total,
        currency: data.currency.toUpperCase(),
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone || null,
        shippingAddress: data.shippingAddress,
        metadata: data.metadata as object | undefined,
        notes: data.notes,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "order_created",
        entityType: "order",
        entityId: order.id,
        details: {
          orderNumber,
          total,
          itemCount: data.items.length,
        },
      },
    });

    return successResponse({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      currency: order.currency,
      // Payment link (in production would be a hosted page)
      paymentUrl: `/checkout/${order.id}`,
      createdAt: order.createdAt,
    }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Order creation error:", error);
    return errorResponse("Failed to create order", 500);
  }
}

// PATCH /api/merchant/orders - Update order (capture, refund, void)
const updateOrderSchema = z.object({
  orderId: z.string(),
  action: z.enum(["capture", "refund", "void"]),
  amount: z.number().positive().optional(), // For partial capture/refund
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireRole(["VENDOR", "ADMIN", "SUPER_ADMIN"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string; role: string };

  try {
    const body = await request.json();
    const data = updateOrderSchema.parse(body);

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: data.orderId },
      include: {
        merchant: true,
        transactions: true,
      },
    });

    if (!order) {
      return errorResponse("Order not found", 404);
    }

    // Verify ownership for vendors
    if (user.role === "VENDOR" && order.merchant.userId !== user.id) {
      return errorResponse("Access denied", 403);
    }

    if (data.action === "capture") {
      if (order.status !== "AUTHORIZED") {
        return errorResponse("Order must be authorized to capture", 400);
      }

      const captureAmount = data.amount || Number(order.authorizedAmount);
      const fee = calculateFee(captureAmount, "PAYMENT");

      // Get merchant wallet
      const merchantWallet = await prisma.wallet.findFirst({
        where: { userId: order.merchant.userId, currency: order.currency },
      });

      if (!merchantWallet) {
        return errorResponse("Merchant wallet not found", 500);
      }

      // Process capture
      await prisma.$transaction(async (tx) => {
        // Create transaction
        await tx.transaction.create({
          data: {
            referenceId: generateReferenceId("CAP"),
            type: "PAYMENT",
            status: "COMPLETED",
            receiverId: order.merchant.userId,
            walletId: merchantWallet.id,
            amount: (captureAmount),
            currency: order.currency,
            fee: (fee),
            netAmount: (captureAmount - fee),
            description: `Order ${order.orderNumber} payment`,
            orderId: order.id,
            processedAt: new Date(),
          },
        });

        // Update order
        await tx.order.update({
          where: { id: order.id },
          data: {
            status: captureAmount >= Number(order.total) ? "CAPTURED" : "PARTIALLY_CAPTURED",
            capturedAmount: (
              Number(order.capturedAmount || 0) + captureAmount
            ),
          },
        });

        // Update wallet
        await tx.wallet.update({
          where: { id: merchantWallet.id },
          data: {
            balance: { increment: captureAmount - fee },
            pendingBalance: { increment: captureAmount - fee }, // Hold for settlement
          },
        });
      });

      return successResponse({
        success: true,
        message: "Payment captured",
        capturedAmount: captureAmount,
        fee,
      });
    } else if (data.action === "refund") {
      if (!["CAPTURED", "PARTIALLY_CAPTURED", "PARTIALLY_REFUNDED"].includes(order.status)) {
        return errorResponse("Order must be captured to refund", 400);
      }

      const refundableAmount =
        Number(order.capturedAmount || 0) - Number(order.refundedAmount || 0);
      const refundAmount = Math.min(data.amount || refundableAmount, refundableAmount);

      if (refundAmount <= 0) {
        return errorResponse("No amount available for refund", 400);
      }

      await prisma.$transaction(async (tx) => {
        // Create refund transaction
        await tx.transaction.create({
          data: {
            referenceId: generateReferenceId("REF"),
            type: "REFUND",
            status: "COMPLETED",
            senderId: order.merchant.userId,
            walletId: (await tx.wallet.findFirst({
              where: { userId: order.merchant.userId, currency: order.currency },
            }))!.id,
            amount: (refundAmount),
            currency: order.currency,
            fee: (0),
            netAmount: (refundAmount),
            description: `Refund for order ${order.orderNumber}`,
            orderId: order.id,
            processedAt: new Date(),
          },
        });

        // Update order
        const newRefundedAmount = Number(order.refundedAmount || 0) + refundAmount;
        await tx.order.update({
          where: { id: order.id },
          data: {
            status:
              newRefundedAmount >= Number(order.capturedAmount)
                ? "REFUNDED"
                : "PARTIALLY_REFUNDED",
            refundedAmount: (newRefundedAmount),
          },
        });
      });

      return successResponse({
        success: true,
        message: "Refund processed",
        refundedAmount: refundAmount,
      });
    } else if (data.action === "void") {
      if (!["PENDING", "AUTHORIZED"].includes(order.status)) {
        return errorResponse("Only pending or authorized orders can be voided", 400);
      }

      await prisma.order.update({
        where: { id: order.id },
        data: { status: "VOIDED" },
      });

      return successResponse({ success: true, message: "Order voided" });
    }

    return errorResponse("Invalid action", 400);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Order update error:", error);
    return errorResponse("Failed to update order", 500);
  }
}
