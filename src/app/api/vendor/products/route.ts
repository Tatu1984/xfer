import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.number().positive("Price must be positive"),
  currency: z.string().default("USD"),
  sku: z.string().optional(),
  category: z.string().optional(),
  inventory: z.number().int().min(0).optional(),
  isActive: z.boolean().default(true),
});

// GET - List vendor's products
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const where: Record<string, unknown> = {
      businessId: business.id,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status === "active") {
      where.isActive = true;
    } else if (status === "inactive") {
      where.isActive = false;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.product.count({ where }),
    ]);

    // Get categories for filter
    const categories = await prisma.product.groupBy({
      by: ["category"],
      where: { businessId: business.id, category: { not: null } },
    });

    return NextResponse.json({
      products,
      categories: categories.map((c) => c.category).filter(Boolean),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + products.length < total,
      },
    });
  } catch (error) {
    console.error("Get products error:", error);
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 });
  }
}

// POST - Create a new product
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const data = productSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Check for duplicate SKU if provided
    if (data.sku) {
      const existing = await prisma.product.findFirst({
        where: { businessId: business.id, sku: data.sku },
      });
      if (existing) {
        return NextResponse.json({ error: "SKU already exists" }, { status: 400 });
      }
    }

    const product = await prisma.product.create({
      data: {
        ...data,
        businessId: business.id,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}

// PATCH - Update a product
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id, businessId: business.id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

// DELETE - Delete a product
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Product ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const product = await prisma.product.findFirst({
      where: { id, businessId: business.id },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
