import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

// Data export API - generate CSV/JSON exports

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get("type") || "transactions";
    const format = searchParams.get("format") || "csv";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const businessId = searchParams.get("businessId");

    // Parse dates
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    let data: Record<string, unknown>[];
    let filename: string;

    switch (exportType) {
      case "transactions":
        data = await exportTransactions(user.id, start, end, businessId);
        filename = `transactions_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}`;
        break;
      case "invoices":
        data = await exportInvoices(user.id, start, end, businessId);
        filename = `invoices_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}`;
        break;
      case "customers":
        if (!businessId) {
          return NextResponse.json({ error: "Business ID required for customer export" }, { status: 400 });
        }
        data = await exportCustomers(businessId, start, end);
        filename = `customers_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}`;
        break;
      case "payouts":
        data = await exportPayouts(user.id, start, end);
        filename = `payouts_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}`;
        break;
      case "disputes":
        data = await exportDisputes(user.id, start, end);
        filename = `disputes_${start.toISOString().split("T")[0]}_to_${end.toISOString().split("T")[0]}`;
        break;
      default:
        return NextResponse.json({ error: "Invalid export type" }, { status: 400 });
    }

    if (format === "csv") {
      const csv = convertToCSV(data);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate export" }, { status: 500 });
  }
}

// POST - Schedule async export for large datasets
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { type, format = "csv", startDate, endDate, businessId, email } = body;

    // For large exports, we queue the job and email the result
    const exportId = `export_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Create notification that export is processing
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: "system",
        title: "Export Started",
        message: `Your ${type} export is being generated. You'll receive a notification when it's ready.`,
        data: { exportId },
      },
    });

    // In production, queue this for background processing
    // For now, simulate async processing
    setTimeout(async () => {
      try {
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        let data: Record<string, unknown>[] = [];

        switch (type) {
          case "transactions":
            data = await exportTransactions(user.id, start, end, businessId);
            break;
          case "invoices":
            data = await exportInvoices(user.id, start, end, businessId);
            break;
        }

        // In production, upload to S3 and send download link via email
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "system",
            title: "Export Ready",
            message: `Your ${type} export with ${data.length} records is ready for download.`,
            data: { exportId, recordCount: data.length },
          },
        });
      } catch (error) {
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "system",
            title: "Export Failed",
            message: `Failed to generate your ${type} export. Please try again.`,
            data: { exportId, error: error instanceof Error ? error.message : "Unknown error" },
          },
        });
      }
    }, 1000);

    return NextResponse.json({
      exportId,
      status: "processing",
      message: "Export is being generated. You will be notified when ready.",
    }, { status: 202 });
  } catch (error) {
    console.error("Schedule export error:", error);
    return NextResponse.json({ error: "Failed to schedule export" }, { status: 500 });
  }
}

async function exportTransactions(
  userId: string,
  startDate: Date,
  endDate: Date,
  businessId?: string | null
): Promise<Record<string, unknown>[]> {
  // If businessId provided, get business owner and filter by that
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

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ senderId: targetUserId }, { receiverId: targetUserId }],
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      sender: { select: { email: true, firstName: true, lastName: true } },
      receiver: { select: { email: true, firstName: true, lastName: true } },
      paymentMethod: { select: { type: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return transactions.map((t) => ({
    id: t.id,
    referenceId: t.referenceId,
    type: t.type,
    status: t.status,
    amount: Number(t.amount),
    currency: t.currency,
    fee: Number(t.fee || 0),
    netAmount: Number(t.amount) - Number(t.fee || 0),
    senderEmail: t.sender?.email || "",
    senderName: t.sender ? `${t.sender.firstName} ${t.sender.lastName}` : "",
    receiverEmail: t.receiver?.email || "",
    receiverName: t.receiver ? `${t.receiver.firstName} ${t.receiver.lastName}` : "",
    description: t.description || "",
    paymentMethod: t.paymentMethod?.type || "",
    createdAt: t.createdAt.toISOString(),
    completedAt: t.processedAt?.toISOString() || "",
  }));
}

async function exportInvoices(
  userId: string,
  startDate: Date,
  endDate: Date,
  businessId?: string | null
): Promise<Record<string, unknown>[]> {
  const whereClause = businessId
    ? { businessId }
    : { business: { userId } };

  const invoices = await prisma.invoice.findMany({
    where: {
      ...whereClause,
      createdAt: { gte: startDate, lte: endDate },
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((inv) => {
    const items = inv.items as unknown[] || [];
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      customerEmail: inv.customerEmail || "",
      customerName: inv.customerName || "",
      subtotal: Number(inv.subtotal),
      taxAmount: Number(inv.tax || 0),
      discountAmount: Number(inv.discount || 0),
      total: Number(inv.total),
      currency: inv.currency,
      itemCount: items.length,
      dueDate: inv.dueDate?.toISOString() || "",
      paidAt: inv.paidAt?.toISOString() || "",
      createdAt: inv.createdAt.toISOString(),
    };
  });
}

async function exportCustomers(
  businessId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, unknown>[]> {
  // Get business owner
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { userId: true },
  });

  if (!business) {
    return [];
  }

  // Get customers who made transactions to the business owner in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      receiverId: business.userId,
      createdAt: { gte: startDate, lte: endDate },
      status: "COMPLETED",
    },
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          country: true,
          createdAt: true,
        },
      },
    },
  });

  // Aggregate by customer
  const customerMap = new Map<
    string,
    {
      customer: typeof transactions[0]["sender"];
      totalSpent: number;
      transactionCount: number;
      firstTransaction: Date;
      lastTransaction: Date;
    }
  >();

  transactions.forEach((t) => {
    if (!t.sender) return;
    const existing = customerMap.get(t.sender.id);
    if (existing) {
      existing.totalSpent += Number(t.amount);
      existing.transactionCount++;
      if (t.createdAt < existing.firstTransaction) existing.firstTransaction = t.createdAt;
      if (t.createdAt > existing.lastTransaction) existing.lastTransaction = t.createdAt;
    } else {
      customerMap.set(t.sender.id, {
        customer: t.sender,
        totalSpent: Number(t.amount),
        transactionCount: 1,
        firstTransaction: t.createdAt,
        lastTransaction: t.createdAt,
      });
    }
  });

  return Array.from(customerMap.values()).map((c) => ({
    id: c.customer?.id || "",
    email: c.customer?.email || "",
    name: c.customer ? `${c.customer.firstName} ${c.customer.lastName}` : "",
    country: c.customer?.country || "",
    totalSpent: c.totalSpent,
    transactionCount: c.transactionCount,
    averageOrderValue: c.totalSpent / c.transactionCount,
    firstTransaction: c.firstTransaction.toISOString(),
    lastTransaction: c.lastTransaction.toISOString(),
    customerSince: c.customer?.createdAt?.toISOString() || "",
  }));
}

async function exportPayouts(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, unknown>[]> {
  const payouts = await prisma.transaction.findMany({
    where: {
      senderId: userId,
      type: "PAYOUT",
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      paymentMethod: {
        select: { bankName: true, accountLast4: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return payouts.map((p) => ({
    id: p.id,
    referenceId: p.referenceId,
    status: p.status,
    amount: Number(p.amount),
    currency: p.currency,
    fee: Number(p.fee || 0),
    bankName: p.paymentMethod?.bankName || "",
    accountLast4: p.paymentMethod?.accountLast4 || "",
    description: p.description || "",
    createdAt: p.createdAt.toISOString(),
    completedAt: p.processedAt?.toISOString() || "",
  }));
}

async function exportDisputes(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<Record<string, unknown>[]> {
  const disputes = await prisma.dispute.findMany({
    where: {
      OR: [{ createdById: userId }, { respondentId: userId }],
      createdAt: { gte: startDate, lte: endDate },
    },
    include: {
      transaction: {
        select: { referenceId: true, amount: true, currency: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return disputes.map((d) => ({
    id: d.id,
    transactionRef: d.transaction?.referenceId || "",
    amount: Number(d.amount),
    currency: d.currency,
    reason: d.reason,
    status: d.status,
    resolution: d.resolution || "",
    buyerEvidence: d.buyerEvidence ? "Yes" : "No",
    sellerEvidence: d.sellerEvidence ? "Yes" : "No",
    createdAt: d.createdAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() || "",
  }));
}

function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map(escapeCSV).join(","));

  // Add data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const value = row[header];
      return escapeCSV(value !== null && value !== undefined ? String(value) : "");
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

function escapeCSV(value: string): string {
  // If value contains comma, newline, or quote, wrap in quotes and escape internal quotes
  if (value.includes(",") || value.includes("\n") || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
