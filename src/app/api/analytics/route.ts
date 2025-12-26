import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

// Analytics API - comprehensive business and transaction analytics

// GET - Retrieve analytics data
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string; role: string };

    const { searchParams } = new URL(request.url);
    const view = searchParams.get("view") || "overview";
    const period = searchParams.get("period") || "30d";
    const businessId = searchParams.get("businessId");

    // Calculate date range
    const now = new Date();
    let startDate: Date;
    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // For business-specific analytics
    if (businessId) {
      const business = await prisma.business.findFirst({
        where: { id: businessId, userId: user.id },
      });

      if (!business) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
    }

    if (view === "overview") {
      return await getOverviewAnalytics(user.id, startDate, now, businessId);
    }

    if (view === "transactions") {
      return await getTransactionAnalytics(user.id, startDate, now, businessId);
    }

    if (view === "revenue") {
      return await getRevenueAnalytics(user.id, startDate, now, businessId);
    }

    if (view === "customers") {
      return await getCustomerAnalytics(user.id, startDate, now, businessId);
    }

    if (view === "products") {
      return await getProductAnalytics(businessId, startDate, now);
    }

    if (view === "geography") {
      return await getGeographyAnalytics(user.id, startDate, now);
    }

    return NextResponse.json({ error: "Invalid view" }, { status: 400 });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}

async function getOverviewAnalytics(
  userId: string,
  startDate: Date,
  endDate: Date,
  businessId?: string | null
) {
  // If businessId provided, get business owner
  let targetUserId = userId;
  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });
    if (business) {
      targetUserId = business.userId;
    }
  }

  const whereClause = { OR: [{ senderId: targetUserId }, { receiverId: targetUserId }] };

  // Total volume
  const volume = await prisma.transaction.aggregate({
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _sum: { amount: true, fee: true },
    _count: true,
  });

  // Previous period comparison
  const periodLength = endDate.getTime() - startDate.getTime();
  const previousStart = new Date(startDate.getTime() - periodLength);

  const previousVolume = await prisma.transaction.aggregate({
    where: {
      ...whereClause,
      createdAt: { gte: previousStart, lt: startDate },
      status: "COMPLETED",
    },
    _sum: { amount: true },
    _count: true,
  });

  // Volume by type
  const volumeByType = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _sum: { amount: true },
    _count: true,
  });

  // Daily volume for chart
  const transactions = await prisma.transaction.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    select: { amount: true, createdAt: true },
  });

  const dailyVolume = transactions.reduce(
    (acc, t) => {
      const date = t.createdAt.toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + Number(t.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  // Active disputes
  const activeDisputes = await prisma.dispute.count({
    where: {
      createdAt: { gte: startDate, lte: endDate },
      status: { in: ["OPEN", "ESCALATED"] },
    },
  });

  // Pending payouts
  const pendingPayouts = await prisma.transaction.aggregate({
    where: {
      senderId: userId,
      type: "PAYOUT",
      status: "PENDING",
    },
    _sum: { amount: true },
    _count: true,
  });

  const currentVolume = Number(volume._sum.amount || 0);
  const prevVolume = Number(previousVolume._sum.amount || 0);
  const volumeChange = prevVolume > 0 ? ((currentVolume - prevVolume) / prevVolume) * 100 : 0;

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    overview: {
      totalVolume: currentVolume,
      volumeChange: Math.round(volumeChange * 100) / 100,
      transactionCount: volume._count,
      transactionCountChange:
        previousVolume._count > 0
          ? Math.round(((volume._count - previousVolume._count) / previousVolume._count) * 100)
          : 0,
      totalFees: Number(volume._sum.fee || 0),
      averageTransactionSize: volume._count > 0 ? currentVolume / volume._count : 0,
    },
    volumeByType: volumeByType.map((v) => ({
      type: v.type,
      volume: Number(v._sum.amount || 0),
      count: v._count,
    })),
    dailyVolume: Object.entries(dailyVolume)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    alerts: {
      activeDisputes,
      pendingPayouts: pendingPayouts._count,
      pendingPayoutsAmount: Number(pendingPayouts._sum.amount || 0),
    },
  });
}

async function getTransactionAnalytics(
  userId: string,
  startDate: Date,
  endDate: Date,
  businessId?: string | null
) {
  // If businessId provided, get business owner
  let targetUserId = userId;
  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });
    if (business) {
      targetUserId = business.userId;
    }
  }

  const whereClause = { OR: [{ senderId: targetUserId }, { receiverId: targetUserId }] };

  // Status breakdown
  const byStatus = await prisma.transaction.groupBy({
    by: ["status"],
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
    },
    _count: true,
    _sum: { amount: true },
  });

  // Payment method breakdown - group by paymentMethodId and join to get type
  const transactionsWithPaymentMethod = await prisma.transaction.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    select: {
      amount: true,
      paymentMethod: { select: { type: true } },
    },
  });

  const byPaymentMethod = transactionsWithPaymentMethod.reduce(
    (acc, t) => {
      const type = t.paymentMethod?.type || "unknown";
      if (!acc[type]) {
        acc[type] = { type, count: 0, volume: 0 };
      }
      acc[type].count++;
      acc[type].volume += Number(t.amount);
      return acc;
    },
    {} as Record<string, { type: string; count: number; volume: number }>
  );

  // Currency breakdown
  const byCurrency = await prisma.transaction.groupBy({
    by: ["currency"],
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _count: true,
    _sum: { amount: true },
  });

  // Success rate
  const totalTransactions = byStatus.reduce((sum, s) => sum + s._count, 0);
  const completedTransactions = byStatus.find((s) => s.status === "COMPLETED")?._count || 0;
  const failedTransactions = byStatus.find((s) => s.status === "FAILED")?._count || 0;

  // Average processing time (simulated - would need timestamps)
  const avgProcessingTime = 2.5; // seconds

  // Hourly distribution
  const transactions = await prisma.transaction.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    select: { createdAt: true },
  });

  const hourlyDistribution = Array(24).fill(0);
  transactions.forEach((t) => {
    hourlyDistribution[t.createdAt.getHours()]++;
  });

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    statusBreakdown: byStatus.map((s) => ({
      status: s.status,
      count: s._count,
      volume: Number(s._sum.amount || 0),
    })),
    paymentMethodBreakdown: (Object.values(byPaymentMethod) as { type: string; count: number; volume: number }[]).map((p) => ({
      method: p.type,
      count: p.count,
      volume: p.volume,
    })),
    currencyBreakdown: byCurrency.map((c) => ({
      currency: c.currency,
      count: c._count,
      volume: Number(c._sum.amount || 0),
    })),
    metrics: {
      successRate: totalTransactions > 0 ? (completedTransactions / totalTransactions) * 100 : 0,
      failureRate: totalTransactions > 0 ? (failedTransactions / totalTransactions) * 100 : 0,
      avgProcessingTime,
    },
    hourlyDistribution: hourlyDistribution.map((count, hour) => ({ hour, count })),
  });
}

async function getRevenueAnalytics(
  userId: string,
  startDate: Date,
  endDate: Date,
  businessId?: string | null
) {
  // If businessId provided, get business owner
  let targetUserId = userId;
  if (businessId) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { userId: true },
    });
    if (business) {
      targetUserId = business.userId;
    }
  }

  // Income (money received)
  const income = await prisma.transaction.aggregate({
    where: {
      receiverId: targetUserId,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _sum: { amount: true },
    _count: true,
  });

  // Expenses (money sent, fees, refunds)
  const expenses = await prisma.transaction.aggregate({
    where: {
      senderId: targetUserId,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _sum: { amount: true, fee: true },
    _count: true,
  });

  // Refunds issued
  const refunds = await prisma.transaction.aggregate({
    where: {
      senderId: targetUserId,
      type: "REFUND",
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _sum: { amount: true },
    _count: true,
  });

  // Daily revenue
  const dailyIncome = await prisma.transaction.findMany({
    where: {
      receiverId: targetUserId,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    select: { amount: true, createdAt: true },
  });

  const revenueByDay = dailyIncome.reduce(
    (acc, t) => {
      const date = t.createdAt.toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + Number(t.amount);
      return acc;
    },
    {} as Record<string, number>
  );

  const totalIncome = Number(income._sum.amount || 0);
  const totalExpenses = Number(expenses._sum.amount || 0) + Number(expenses._sum.fee || 0);
  const totalRefunds = Number(refunds._sum.amount || 0);

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    revenue: {
      grossIncome: totalIncome,
      totalExpenses,
      totalFees: Number(expenses._sum.fee || 0),
      totalRefunds,
      netRevenue: totalIncome - totalRefunds,
    },
    counts: {
      incomeTransactions: income._count,
      expenseTransactions: expenses._count,
      refundTransactions: refunds._count,
    },
    dailyRevenue: Object.entries(revenueByDay)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
}

async function getCustomerAnalytics(
  userId: string,
  startDate: Date,
  endDate: Date,
  businessId?: string | null
) {
  if (!businessId) {
    return NextResponse.json({ error: "Business ID required for customer analytics" }, { status: 400 });
  }

  // Get the business to find its owner
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { userId: true },
  });

  if (!business) {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  // Unique customers - transactions where the business owner is the receiver
  const customers = await prisma.transaction.groupBy({
    by: ["senderId"],
    where: {
      receiverId: business.userId,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    _count: true,
    _sum: { amount: true },
  });

  // New vs returning
  const previousCustomers = await prisma.transaction.findMany({
    where: {
      receiverId: business.userId,
      createdAt: { lt: startDate },
      status: "COMPLETED",
    },
    select: { senderId: true },
    distinct: ["senderId"],
  });

  const previousCustomerIds = new Set(previousCustomers.map((c) => c.senderId));
  const newCustomers = customers.filter((c) => !previousCustomerIds.has(c.senderId));
  const returningCustomers = customers.filter((c) => previousCustomerIds.has(c.senderId));

  // Top customers
  const topCustomers = customers
    .sort((a, b) => Number(b._sum.amount || 0) - Number(a._sum.amount || 0))
    .slice(0, 10);

  // Get customer details
  const topCustomerDetails = await prisma.user.findMany({
    where: { id: { in: topCustomers.map((c) => c.senderId).filter(Boolean) as string[] } },
    select: { id: true, firstName: true, lastName: true, email: true },
  });

  // Customer retention (customers who made repeat purchases)
  const repeatCustomers = customers.filter((c) => c._count > 1);

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    summary: {
      totalCustomers: customers.length,
      newCustomers: newCustomers.length,
      returningCustomers: returningCustomers.length,
      repeatPurchaseRate: customers.length > 0 ? (repeatCustomers.length / customers.length) * 100 : 0,
    },
    revenue: {
      fromNewCustomers: newCustomers.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0),
      fromReturningCustomers: returningCustomers.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0),
      averageOrderValue:
        customers.length > 0
          ? customers.reduce((sum, c) => sum + Number(c._sum.amount || 0), 0) / customers.length
          : 0,
    },
    topCustomers: topCustomers.map((c) => {
      const details = topCustomerDetails.find((d) => d.id === c.senderId);
      return {
        id: c.senderId,
        name: details ? `${details.firstName} ${details.lastName}` : "Unknown",
        email: details?.email,
        totalSpent: Number(c._sum.amount || 0),
        transactionCount: c._count,
      };
    }),
  });
}

async function getProductAnalytics(
  businessId: string | null,
  startDate: Date,
  endDate: Date
) {
  if (!businessId) {
    return NextResponse.json({ error: "Business ID required for product analytics" }, { status: 400 });
  }

  // Product sales - get products
  const products = await prisma.product.findMany({
    where: { businessId },
  });

  // Get paid invoices in period (items are stored as JSON)
  const invoices = await prisma.invoice.findMany({
    where: {
      businessId,
      createdAt: { gte: startDate, lte: endDate },
      status: "PAID",
    },
    select: { items: true, total: true },
  });

  // Aggregate by product from invoice items JSON
  const productSales = invoices.reduce(
    (acc, invoice) => {
      const items = invoice.items as Array<{ productId?: string; name?: string; description?: string; quantity?: number; amount?: number }> || [];
      items.forEach((item) => {
        const productId = item.productId || "other";
        if (!acc[productId]) {
          acc[productId] = {
            productId,
            name: item.name || item.description || "Other",
            quantity: 0,
            revenue: 0,
          };
        }
        acc[productId].quantity += item.quantity || 1;
        acc[productId].revenue += Number(item.amount || 0);
      });
      return acc;
    },
    {} as Record<string, { productId: string; name: string; quantity: number; revenue: number }>
  );

  const sortedProducts = (Object.values(productSales) as { productId: string; name: string; quantity: number; revenue: number }[]).sort((a, b) => b.revenue - a.revenue);

  // Calculate totals from aggregated product sales
  const totalSales = sortedProducts.reduce((sum, p) => sum + p.revenue, 0);
  const totalUnitsSold = sortedProducts.reduce((sum, p) => sum + p.quantity, 0);

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    totalProducts: products.length,
    totalSales,
    totalUnitsSold,
    topProducts: sortedProducts.slice(0, 10),
    allProducts: sortedProducts,
  });
}

async function getGeographyAnalytics(userId: string, startDate: Date, endDate: Date) {
  // Get transactions with sender country info
  const transactions = await prisma.transaction.findMany({
    where: {
      receiverId: userId,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    include: {
      sender: {
        select: { country: true },
      },
    },
  });

  // Aggregate by country
  const byCountry = transactions.reduce(
    (acc, t) => {
      const country = t.sender?.country || "Unknown";
      if (!acc[country]) {
        acc[country] = { country, count: 0, volume: 0 };
      }
      acc[country].count++;
      acc[country].volume += Number(t.amount);
      return acc;
    },
    {} as Record<string, { country: string; count: number; volume: number }>
  );

  const sortedCountries = (Object.values(byCountry) as { country: string; count: number; volume: number }[]).sort((a, b) => b.volume - a.volume);

  return NextResponse.json({
    period: { start: startDate.toISOString(), end: endDate.toISOString() },
    totalCountries: sortedCountries.length,
    distribution: sortedCountries,
    topCountries: sortedCountries.slice(0, 10),
  });
}
