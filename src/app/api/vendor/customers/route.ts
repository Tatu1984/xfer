import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

// GET - List vendor's customers
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
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Get unique customers from orders
    const ordersQuery: Record<string, unknown> = {
      businessId: business.id,
    };

    if (search) {
      ordersQuery.OR = [
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get distinct customers with their order stats
    const orders = await prisma.order.findMany({
      where: ordersQuery,
      select: {
        customerEmail: true,
        customerName: true,
        total: true,
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Aggregate by customer email
    const customerMap = new Map<
      string,
      {
        email: string;
        name: string | null;
        orderCount: number;
        totalSpent: number;
        lastOrderDate: Date;
        firstOrderDate: Date;
      }
    >();

    orders.forEach((order) => {
      const existing = customerMap.get(order.customerEmail);
      if (existing) {
        existing.orderCount++;
        existing.totalSpent += Number(order.total);
        if (order.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = order.createdAt;
        }
        if (order.createdAt < existing.firstOrderDate) {
          existing.firstOrderDate = order.createdAt;
        }
      } else {
        customerMap.set(order.customerEmail, {
          email: order.customerEmail,
          name: order.customerName,
          orderCount: 1,
          totalSpent: Number(order.total),
          lastOrderDate: order.createdAt,
          firstOrderDate: order.createdAt,
        });
      }
    });

    const customers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(offset, offset + limit);

    const total = customerMap.size;

    return NextResponse.json({
      customers,
      stats: {
        totalCustomers: total,
        totalRevenue: Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalSpent, 0),
        averageOrderValue:
          orders.length > 0
            ? orders.reduce((sum, o) => sum + Number(o.total), 0) / orders.length
            : 0,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + customers.length < total,
      },
    });
  } catch (error) {
    console.error("Get customers error:", error);
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 });
  }
}
