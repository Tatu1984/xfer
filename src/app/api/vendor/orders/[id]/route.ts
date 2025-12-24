import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["PROCESSING", "SHIPPED", "DELIVERED", "COMPLETED"]).optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { id } = await params;

    // Get vendor's business
    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return errorResponse("Business not found", 404);
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        merchantId: business.id,
      },
      include: {
        transactions: {
          select: {
            id: true,
            referenceId: true,
            status: true,
            amount: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse("Order not found", 404);
    }

    return successResponse({ order });
  } catch (error) {
    console.error("Vendor get order error:", error);
    return errorResponse("Failed to fetch order", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const { id } = await params;
    const body = await request.json();
    const validated = updateSchema.parse(body);

    // Get vendor's business
    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return errorResponse("Business not found", 404);
    }

    const order = await prisma.order.findFirst({
      where: {
        id,
        merchantId: business.id,
      },
    });

    if (!order) {
      return errorResponse("Order not found", 404);
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      CAPTURED: ["PROCESSING", "SHIPPED"],
      PROCESSING: ["SHIPPED", "DELIVERED"],
      SHIPPED: ["DELIVERED", "COMPLETED"],
      DELIVERED: ["COMPLETED"],
    };

    if (validated.status) {
      const allowedStatuses = validTransitions[order.status] || [];
      if (!allowedStatuses.includes(validated.status)) {
        return errorResponse(`Cannot transition from ${order.status} to ${validated.status}`, 400);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (validated.status) updateData.status = validated.status;
    if (validated.notes !== undefined) updateData.notes = validated.notes;
    if (validated.metadata) {
      // Merge with existing metadata
      const existingMetadata = (order.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...existingMetadata, ...validated.metadata };
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    return successResponse({ order: updatedOrder });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Vendor update order error:", error);
    return errorResponse("Failed to update order", 500);
  }
}
