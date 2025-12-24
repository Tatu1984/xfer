import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const couponSchema = z.object({
  code: z.string().min(3).max(20).transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  discountType: z.enum(["percentage", "fixed"]),
  discountValue: z.number().positive(),
  currency: z.string().length(3).optional(),
  minPurchase: z.number().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  usageLimit: z.number().positive().optional(),
  perUserLimit: z.number().positive().default(1),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});

// GET - List coupons
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const where: Record<string, unknown> = { businessId: business.id };
    if (active === "true") {
      where.isActive = true;
      where.OR = [
        { validUntil: null },
        { validUntil: { gt: new Date() } },
      ];
    }

    const coupons = await prisma.coupon.findMany({
      where,
      include: {
        _count: { select: { usages: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      coupons: coupons.map((c) => ({
        ...c,
        usageCount: c._count.usages,
      })),
    });
  } catch (error) {
    console.error("Get coupons error:", error);
    return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
  }
}

// POST - Create coupon
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = couponSchema.parse(body);

    // Check if code already exists for this business
    const existing = await prisma.coupon.findFirst({
      where: { businessId: business.id, code: data.code },
    });

    if (existing) {
      return NextResponse.json({ error: "Coupon code already exists" }, { status: 400 });
    }

    // Validate fixed discount has currency
    if (data.discountType === "fixed" && !data.currency) {
      return NextResponse.json(
        { error: "Currency required for fixed discount" },
        { status: 400 }
      );
    }

    // Validate percentage discount
    if (data.discountType === "percentage" && data.discountValue > 100) {
      return NextResponse.json(
        { error: "Percentage discount cannot exceed 100%" },
        { status: 400 }
      );
    }

    const coupon = await prisma.coupon.create({
      data: {
        businessId: business.id,
        code: data.code,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        currency: data.currency,
        minPurchase: data.minPurchase,
        maxDiscount: data.maxDiscount,
        usageLimit: data.usageLimit,
        perUserLimit: data.perUserLimit,
        validFrom: data.validFrom ? new Date(data.validFrom) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
      },
    });

    return NextResponse.json({ coupon }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create coupon error:", error);
    return NextResponse.json({ error: "Failed to create coupon" }, { status: 500 });
  }
}

// PATCH - Update coupon
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Coupon ID required" }, { status: 400 });
    }

    const coupon = await prisma.coupon.findFirst({
      where: { id, businessId: business.id },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    const updated = await prisma.coupon.update({
      where: { id },
      data: {
        ...updates,
        validFrom: updates.validFrom ? new Date(updates.validFrom) : undefined,
        validUntil: updates.validUntil ? new Date(updates.validUntil) : undefined,
      },
    });

    return NextResponse.json({ coupon: updated });
  } catch (error) {
    console.error("Update coupon error:", error);
    return NextResponse.json({ error: "Failed to update coupon" }, { status: 500 });
  }
}

// DELETE - Delete coupon
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const business = await prisma.business.findUnique({
      where: { userId: authResult.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Coupon ID required" }, { status: 400 });
    }

    const coupon = await prisma.coupon.findFirst({
      where: { id, businessId: business.id },
    });

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }

    // Soft delete by deactivating
    await prisma.coupon.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete coupon error:", error);
    return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
  }
}
