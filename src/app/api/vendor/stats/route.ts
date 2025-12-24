import { NextRequest } from "next/server";
import {
  requireRole,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/vendor/stats - Get vendor dashboard statistics
export async function GET(request: NextRequest) {
  const authResult = await requireRole(["VENDOR"]);
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  // Get business
  const business = await prisma.business.findUnique({
    where: { userId: user.id },
  });

  if (!business) {
    return errorResponse("Business profile not found", 404);
  }

  // Get date ranges
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Get all stats in parallel
  const [
    ordersThisMonth,
    ordersLastMonth,
    wallets,
    recentOrders,
    pendingPayouts,
    topProducts,
  ] = await Promise.all([
    // Orders this month
    prisma.order.aggregate({
      where: {
        merchantId: business.id,
        createdAt: { gte: thirtyDaysAgo },
        status: "CAPTURED",
      },
      _sum: { total: true },
      _count: true,
    }),
    // Orders last month
    prisma.order.aggregate({
      where: {
        merchantId: business.id,
        createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
        status: "CAPTURED",
      },
      _sum: { total: true },
      _count: true,
    }),
    // Get wallets
    prisma.wallet.findMany({
      where: { userId: user.id },
    }),
    // Recent orders
    prisma.order.findMany({
      where: { merchantId: business.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    // Pending payouts
    prisma.payout.aggregate({
      where: {
        businessId: business.id,
        status: { in: ["PENDING", "PROCESSING"] },
      },
      _sum: { netAmount: true },
    }),
    // Top products (from orders)
    prisma.order.findMany({
      where: {
        merchantId: business.id,
        createdAt: { gte: thirtyDaysAgo },
        status: "CAPTURED",
      },
      select: { items: true, total: true },
      take: 100,
    }),
  ]);

  // Calculate revenue
  const revenueThisMonth = Number(ordersThisMonth._sum.total || 0);
  const revenueLastMonth = Number(ordersLastMonth._sum.total || 0);
  const revenueChange = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
    : 0;

  // Calculate order changes
  const ordersChange = ordersLastMonth._count > 0
    ? ((ordersThisMonth._count - ordersLastMonth._count) / ordersLastMonth._count) * 100
    : 0;

  // Get unique customers (simplified - from orders)
  const uniqueCustomers = await prisma.order.groupBy({
    by: ["customerEmail"],
    where: {
      merchantId: business.id,
      customerEmail: { not: "" },
    },
    _count: true,
  });

  // Extract top products from order items
  const productSales: Record<string, { name: string; sales: number; revenue: number }> = {};
  for (const order of topProducts) {
    const items = order.items as Array<{ name: string; quantity: number; unitPrice: number }>;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (!productSales[item.name]) {
          productSales[item.name] = { name: item.name, sales: 0, revenue: 0 };
        }
        productSales[item.name].sales += item.quantity;
        productSales[item.name].revenue += item.quantity * item.unitPrice;
      }
    }
  }
  const topProductsList = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Get available balance
  const availableBalance = wallets.reduce((sum, w) => sum + Number(w.availableBalance), 0);

  // Get last payout
  const lastPayout = await prisma.payout.findFirst({
    where: { businessId: business.id, status: "COMPLETED" },
    orderBy: { processedAt: "desc" },
  });

  // Get next scheduled payout
  const nextPayout = await prisma.payout.findFirst({
    where: { businessId: business.id, status: { in: ["PENDING", "PROCESSING"] } },
    orderBy: { createdAt: "asc" },
  });

  return successResponse({
    stats: {
      revenue: revenueThisMonth,
      revenueChange: Math.round(revenueChange * 10) / 10,
      orders: ordersThisMonth._count,
      ordersChange: Math.round(ordersChange * 10) / 10,
      customers: uniqueCustomers.length,
      pendingPayouts: Number(pendingPayouts._sum.netAmount || 0),
      availableBalance,
    },
    recentOrders: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerEmail: o.customerEmail,
      total: Number(o.total),
      currency: o.currency,
      status: o.status,
      createdAt: o.createdAt,
    })),
    topProducts: topProductsList,
    payouts: {
      pending: Number(pendingPayouts._sum.netAmount || 0),
      lastPayout: lastPayout
        ? {
            amount: Number(lastPayout.netAmount),
            date: lastPayout.processedAt,
          }
        : null,
      nextPayout: nextPayout
        ? {
            amount: Number(nextPayout.netAmount),
            estimatedDate: nextPayout.createdAt,
          }
        : null,
    },
    business: {
      name: business.tradingName || business.legalName,
      kybStatus: business.kybStatus,
    },
  });
}
