import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-utils";

const addItemSchema = z.object({
  merchantId: z.string(),
  productId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const updateItemSchema = z.object({
  itemId: z.string(),
  quantity: z.number().positive(),
});

const applyCouponSchema = z.object({
  couponCode: z.string(),
});

// Calculate cart totals
async function calculateCartTotals(cartId: string, couponId?: string | null) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
  });

  const subtotal = items.reduce((sum, item) => sum + Number(item.total), 0);

  // Get cart for merchant and location info
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
  });

  if (!cart) return { subtotal: 0, tax: 0, discount: 0, total: 0 };

  // Calculate tax
  // In production, use tax rate based on shipping address
  const taxRate = 0.08; // 8% default
  const tax = subtotal * taxRate;

  // Calculate discount
  let discount = 0;
  if (couponId) {
    const coupon = await prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (coupon && coupon.isActive) {
      if (coupon.discountType === "percentage") {
        discount = subtotal * (Number(coupon.discountValue) / 100);
      } else {
        discount = Number(coupon.discountValue);
      }

      // Apply max discount if set
      if (coupon.maxDiscount && discount > Number(coupon.maxDiscount)) {
        discount = Number(coupon.maxDiscount);
      }
    }
  }

  const total = subtotal + tax - discount;

  return { subtotal, tax, discount, total };
}

// GET - Get cart
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get("merchantId");

    if (!merchantId) {
      return NextResponse.json({ error: "Merchant ID required" }, { status: 400 });
    }

    const cart = await prisma.cart.findFirst({
      where: {
        userId: user.id,
        merchantId,
        expiresAt: { gt: new Date() },
      },
      include: {
        items: true,
        coupon: {
          select: {
            id: true,
            code: true,
            discountType: true,
            discountValue: true,
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json({ cart: null });
    }

    return NextResponse.json({ cart });
  } catch (error) {
    console.error("Get cart error:", error);
    return NextResponse.json({ error: "Failed to fetch cart" }, { status: 500 });
  }
}

// POST - Add item to cart
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const data = addItemSchema.parse(body);

    // Find or create cart
    let cart = await prisma.cart.findFirst({
      where: {
        userId: user.id,
        merchantId: data.merchantId,
        expiresAt: { gt: new Date() },
      },
    });

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    if (!cart) {
      cart = await prisma.cart.create({
        data: {
          userId: user.id,
          merchantId: data.merchantId,
          expiresAt,
        },
      });
    }

    // Check if item already exists
    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId: cart.id,
        productId: data.productId,
      },
    });

    if (existingItem) {
      // Update quantity
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: existingItem.quantity + data.quantity,
          total: (existingItem.quantity + data.quantity) * Number(existingItem.unitPrice),
        },
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: data.productId,
          name: data.name,
          description: data.description,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          total: data.quantity * data.unitPrice,
          metadata: data.metadata as object | undefined,
        },
      });
    }

    // Recalculate totals
    const totals = await calculateCartTotals(cart.id, cart.couponId);

    const updatedCart = await prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
      },
      include: { items: true },
    });

    return NextResponse.json({ cart: updatedCart });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Add to cart error:", error);
    return NextResponse.json({ error: "Failed to add item" }, { status: 500 });
  }
}

// PATCH - Update cart item or apply coupon
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();

    // Apply coupon
    if (body.couponCode !== undefined) {
      const { couponCode } = applyCouponSchema.parse(body);
      const { cartId } = body;

      if (!cartId) {
        return NextResponse.json({ error: "Cart ID required" }, { status: 400 });
      }

      const cart = await prisma.cart.findFirst({
        where: { id: cartId, userId: user.id },
      });

      if (!cart) {
        return NextResponse.json({ error: "Cart not found" }, { status: 404 });
      }

      // Find coupon
      const coupon = await prisma.coupon.findFirst({
        where: {
          code: couponCode.toUpperCase(),
          businessId: cart.merchantId,
          isActive: true,
          validFrom: { lte: new Date() },
          OR: [
            { validUntil: null },
            { validUntil: { gt: new Date() } },
          ],
        },
      });

      if (!coupon) {
        return NextResponse.json({ error: "Invalid or expired coupon" }, { status: 400 });
      }

      // Check usage limit
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }

      // Check per-user limit
      const userUsage = await prisma.couponUsage.count({
        where: { couponId: coupon.id, userId: user.id },
      });

      if (userUsage >= coupon.perUserLimit) {
        return NextResponse.json({ error: "You have already used this coupon" }, { status: 400 });
      }

      // Check minimum purchase
      if (coupon.minPurchase && Number(cart.subtotal) < Number(coupon.minPurchase)) {
        return NextResponse.json({
          error: `Minimum purchase of ${coupon.minPurchase} required`,
        }, { status: 400 });
      }

      // Apply coupon
      const totals = await calculateCartTotals(cart.id, coupon.id);

      const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: {
          couponId: coupon.id,
          discount: totals.discount,
          total: totals.total,
        },
        include: { items: true, coupon: true },
      });

      return NextResponse.json({
        success: true,
        cart: updatedCart,
        message: `Coupon applied: ${coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `$${coupon.discountValue} off`}`,
      });
    }

    // Update item quantity
    const { itemId, quantity } = updateItemSchema.parse(body);

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== user.id) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity,
        total: quantity * Number(item.unitPrice),
      },
    });

    // Recalculate totals
    const totals = await calculateCartTotals(item.cartId, item.cart.couponId);

    const updatedCart = await prisma.cart.update({
      where: { id: item.cartId },
      data: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
      },
      include: { items: true },
    });

    return NextResponse.json({ cart: updatedCart });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Update cart error:", error);
    return NextResponse.json({ error: "Failed to update cart" }, { status: 500 });
  }
}

// DELETE - Remove item from cart
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const cartId = searchParams.get("cartId");

    if (cartId && !itemId) {
      // Clear entire cart
      const cart = await prisma.cart.findFirst({
        where: { id: cartId, userId: user.id },
      });

      if (!cart) {
        return NextResponse.json({ error: "Cart not found" }, { status: 404 });
      }

      await prisma.cartItem.deleteMany({
        where: { cartId },
      });

      await prisma.cart.update({
        where: { id: cartId },
        data: {
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          couponId: null,
        },
      });

      return NextResponse.json({ success: true, message: "Cart cleared" });
    }

    if (!itemId) {
      return NextResponse.json({ error: "Item ID required" }, { status: 400 });
    }

    const item = await prisma.cartItem.findUnique({
      where: { id: itemId },
      include: { cart: true },
    });

    if (!item || item.cart.userId !== user.id) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.cartItem.delete({
      where: { id: itemId },
    });

    // Recalculate totals
    const totals = await calculateCartTotals(item.cartId, item.cart.couponId);

    await prisma.cart.update({
      where: { id: item.cartId },
      data: {
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete cart item error:", error);
    return NextResponse.json({ error: "Failed to remove item" }, { status: 500 });
  }
}
