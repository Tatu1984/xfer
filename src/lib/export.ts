import { prisma } from "@/lib/prisma";

// ============================================
// TYPES
// ============================================

export interface ExportOptions {
  format: "csv" | "json";
  dateRange?: {
    start: Date;
    end: Date;
  };
  filters?: Record<string, unknown>;
}

export interface ExportResult {
  data: string;
  filename: string;
  mimeType: string;
  rowCount: number;
}

// ============================================
// CSV UTILITIES
// ============================================

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";

  const str = String(value);

  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

function formatDate(value: unknown): string {
  if (!value) return "";
  const date = value as Date;
  return date.toISOString();
}

function formatAmount(value: unknown): string {
  if (value === null || value === undefined) return "";
  return (Number(value) / 1).toFixed(2);
}

function arrayToCSV(
  data: Record<string, unknown>[],
  columns: { key: string; header: string; formatter?: (value: unknown) => string }[]
): string {
  // Header row
  const header = columns.map((c) => escapeCSV(c.header)).join(",");

  // Data rows
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const value = row[c.key];
        const formatted = c.formatter ? c.formatter(value) : value;
        return escapeCSV(formatted);
      })
      .join(",")
  );

  return [header, ...rows].join("\n");
}

// ============================================
// TRANSACTION EXPORTS
// ============================================

export async function exportTransactions(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = {
    OR: [{ senderId: userId }, { receiverId: userId }],
  };

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      sender: { select: { email: true, firstName: true, lastName: true } },
      receiver: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const columns = [
    { key: "id", header: "Transaction ID" },
    { key: "referenceId", header: "Reference" },
    { key: "createdAt", header: "Date", formatter: formatDate },
    { key: "type", header: "Type" },
    { key: "status", header: "Status" },
    { key: "amount", header: "Amount", formatter: formatAmount },
    { key: "currency", header: "Currency" },
    { key: "fee", header: "Fee", formatter: formatAmount },
    {
      key: "sender",
      header: "From",
      formatter: (v: unknown) => {
        const s = v as { email: string; firstName?: string; lastName?: string } | null;
        return s ? `${s.firstName || ""} ${s.lastName || ""} (${s.email})`.trim() : "";
      },
    },
    {
      key: "receiver",
      header: "To",
      formatter: (v: unknown) => {
        const r = v as { email: string; firstName?: string; lastName?: string } | null;
        return r ? `${r.firstName || ""} ${r.lastName || ""} (${r.email})`.trim() : "";
      },
    },
    { key: "note", header: "Note" },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(transactions, null, 2),
      filename: `transactions_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: transactions.length,
    };
  }

  const csv = arrayToCSV(transactions, columns);

  return {
    data: csv,
    filename: `transactions_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: transactions.length,
  };
}

// ============================================
// INVOICE EXPORTS
// ============================================

export async function exportInvoices(
  vendorId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = { businessId: vendorId };

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const columns = [
    { key: "invoiceNumber", header: "Invoice #" },
    { key: "createdAt", header: "Created", formatter: formatDate },
    { key: "dueDate", header: "Due Date", formatter: formatDate },
    { key: "status", header: "Status" },
    { key: "customerName", header: "Customer Name" },
    { key: "customerEmail", header: "Customer Email" },
    { key: "subtotal", header: "Subtotal", formatter: formatAmount },
    { key: "tax", header: "Tax", formatter: formatAmount },
    { key: "total", header: "Total", formatter: formatAmount },
    { key: "paidAmount", header: "Paid", formatter: formatAmount },
    { key: "currency", header: "Currency" },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(invoices, null, 2),
      filename: `invoices_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: invoices.length,
    };
  }

  const csv = arrayToCSV(invoices, columns);

  return {
    data: csv,
    filename: `invoices_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: invoices.length,
  };
}

// ============================================
// PAYOUT EXPORTS
// ============================================

export async function exportPayouts(
  vendorId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = { userId: vendorId };

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const payouts = await prisma.payout.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const columns = [
    { key: "id", header: "Payout ID" },
    { key: "createdAt", header: "Date", formatter: formatDate },
    { key: "status", header: "Status" },
    { key: "amount", header: "Amount", formatter: formatAmount },
    { key: "currency", header: "Currency" },
    { key: "fee", header: "Fee", formatter: formatAmount },
    { key: "speed", header: "Speed" },
    { key: "arrivalDate", header: "Arrival Date", formatter: formatDate },
    { key: "destination", header: "Destination" },
    { key: "failureReason", header: "Failure Reason" },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(payouts, null, 2),
      filename: `payouts_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: payouts.length,
    };
  }

  const csv = arrayToCSV(payouts, columns);

  return {
    data: csv,
    filename: `payouts_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: payouts.length,
  };
}

// ============================================
// CUSTOMER EXPORTS (derived from Orders)
// ============================================

export async function exportCustomers(
  vendorId: string,
  options: ExportOptions
): Promise<ExportResult> {
  // Aggregate unique customers from orders
  const orders = await prisma.order.findMany({
    where: { merchantId: vendorId },
    select: {
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      total: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate customer data
  const customerMap = new Map<string, {
    email: string;
    name: string;
    phone: string;
    totalSpent: number;
    orderCount: number;
    lastOrderAt: Date;
    firstOrderAt: Date;
  }>();

  for (const order of orders) {
    const existing = customerMap.get(order.customerEmail);
    if (existing) {
      existing.totalSpent += Number(order.total);
      existing.orderCount += 1;
      if (order.createdAt > existing.lastOrderAt) {
        existing.lastOrderAt = order.createdAt;
      }
      if (order.createdAt < existing.firstOrderAt) {
        existing.firstOrderAt = order.createdAt;
      }
    } else {
      customerMap.set(order.customerEmail, {
        email: order.customerEmail,
        name: order.customerName || "",
        phone: order.customerPhone || "",
        totalSpent: Number(order.total),
        orderCount: 1,
        lastOrderAt: order.createdAt,
        firstOrderAt: order.createdAt,
      });
    }
  }

  const customers = Array.from(customerMap.values());

  const columns = [
    { key: "email", header: "Email" },
    { key: "name", header: "Name" },
    { key: "phone", header: "Phone" },
    { key: "firstOrderAt", header: "First Order", formatter: formatDate },
    { key: "totalSpent", header: "Total Spent", formatter: formatAmount },
    { key: "orderCount", header: "Orders" },
    { key: "lastOrderAt", header: "Last Order", formatter: formatDate },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(customers, null, 2),
      filename: `customers_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: customers.length,
    };
  }

  const csv = arrayToCSV(customers as unknown as Record<string, unknown>[], columns);

  return {
    data: csv,
    filename: `customers_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: customers.length,
  };
}

// ============================================
// ORDER EXPORTS
// ============================================

export async function exportOrders(
  vendorId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = { merchantId: vendorId };

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const columns = [
    { key: "orderNumber", header: "Order #" },
    { key: "createdAt", header: "Date", formatter: formatDate },
    { key: "status", header: "Status" },
    { key: "customerName", header: "Customer Name" },
    { key: "customerEmail", header: "Customer Email" },
    { key: "total", header: "Amount", formatter: formatAmount },
    { key: "currency", header: "Currency" },
    { key: "capturedAmount", header: "Captured", formatter: formatAmount },
    { key: "refundedAmount", header: "Refunded", formatter: formatAmount },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(orders, null, 2),
      filename: `orders_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: orders.length,
    };
  }

  const csv = arrayToCSV(orders, columns);

  return {
    data: csv,
    filename: `orders_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: orders.length,
  };
}

// ============================================
// DISPUTE EXPORTS
// ============================================

export async function exportDisputes(
  userId: string,
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = {
    OR: [{ createdById: userId }, { respondentId: userId }],
  };

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const disputes = await prisma.dispute.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      transaction: { select: { referenceId: true } },
    },
  });

  const columns = [
    { key: "id", header: "Dispute ID" },
    { key: "createdAt", header: "Opened", formatter: formatDate },
    { key: "type", header: "Type" },
    { key: "status", header: "Status" },
    { key: "reason", header: "Reason" },
    { key: "amount", header: "Amount", formatter: formatAmount },
    { key: "currency", header: "Currency" },
    {
      key: "transaction",
      header: "Transaction Ref",
      formatter: (v: unknown) => {
        const t = v as { referenceId: string } | null;
        return t?.referenceId || "";
      },
    },
    { key: "resolution", header: "Resolution" },
    { key: "refundAmount", header: "Refund", formatter: formatAmount },
    { key: "resolvedAt", header: "Resolved", formatter: formatDate },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(disputes, null, 2),
      filename: `disputes_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: disputes.length,
    };
  }

  const csv = arrayToCSV(disputes, columns);

  return {
    data: csv,
    filename: `disputes_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: disputes.length,
  };
}

// ============================================
// TAX REPORT EXPORTS
// ============================================

export async function exportTaxReport(
  userId: string,
  year: number
): Promise<ExportResult> {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  // Get all completed transactions for the year
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
      status: "COMPLETED",
      createdAt: {
        gte: startOfYear,
        lte: endOfYear,
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Calculate summary
  const received = transactions
    .filter((t) => t.receiverId === userId)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const sent = transactions
    .filter((t) => t.senderId === userId)
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const fees = transactions
    .filter((t) => t.senderId === userId)
    .reduce((sum, t) => sum + Number(t.fee), 0);

  const summary = {
    year,
    totalReceived: received,
    totalSent: sent,
    totalFees: fees,
    netFlow: received - sent,
    transactionCount: transactions.length,
    generatedAt: new Date().toISOString(),
  };

  // Generate report
  const report = {
    summary,
    transactions: transactions.map((t) => ({
      date: t.createdAt.toISOString().split("T")[0],
      type: t.type,
      amount: Number(t.amount),
      currency: t.currency,
      fee: Number(t.fee),
      reference: t.referenceId,
      direction: t.receiverId === userId ? "received" : "sent",
    })),
  };

  return {
    data: JSON.stringify(report, null, 2),
    filename: `tax_report_${year}_${Date.now()}.json`,
    mimeType: "application/json",
    rowCount: transactions.length,
  };
}

// ============================================
// ADMIN EXPORTS
// ============================================

export async function exportComplianceAlerts(
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = {};

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const alerts = await prisma.complianceAlert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true, firstName: true, lastName: true } },
    },
  });

  const columns = [
    { key: "id", header: "Alert ID" },
    { key: "createdAt", header: "Date", formatter: formatDate },
    { key: "alertType", header: "Type" },
    { key: "severity", header: "Severity" },
    { key: "status", header: "Status" },
    { key: "title", header: "Title" },
    {
      key: "user",
      header: "User",
      formatter: (v: unknown) => {
        const u = v as { email: string; firstName?: string; lastName?: string } | null;
        return u ? `${u.firstName || ""} ${u.lastName || ""} (${u.email})`.trim() : "";
      },
    },
    { key: "description", header: "Description" },
    { key: "resolvedAt", header: "Resolved", formatter: formatDate },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(alerts, null, 2),
      filename: `compliance_alerts_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: alerts.length,
    };
  }

  const csv = arrayToCSV(alerts, columns);

  return {
    data: csv,
    filename: `compliance_alerts_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: alerts.length,
  };
}

export async function exportUsers(options: ExportOptions): Promise<ExportResult> {
  const where: Record<string, unknown> = {};

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      country: true,
      createdAt: true,
      emailVerified: true,
      mfaEnabled: true,
    },
  });

  const columns = [
    { key: "id", header: "User ID" },
    { key: "email", header: "Email" },
    { key: "firstName", header: "First Name" },
    { key: "lastName", header: "Last Name" },
    { key: "role", header: "Role" },
    { key: "status", header: "Status" },
    { key: "country", header: "Country" },
    { key: "createdAt", header: "Created", formatter: formatDate },
    { key: "emailVerified", header: "Email Verified", formatter: formatDate },
    { key: "mfaEnabled", header: "MFA Enabled" },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(users, null, 2),
      filename: `users_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: users.length,
    };
  }

  const csv = arrayToCSV(users, columns);

  return {
    data: csv,
    filename: `users_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: users.length,
  };
}

// ============================================
// SETTLEMENT EXPORTS
// ============================================

export async function exportSettlements(
  options: ExportOptions
): Promise<ExportResult> {
  const where: Record<string, unknown> = {};

  if (options.dateRange) {
    where.settlementDate = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  const settlements = await prisma.settlementBatch.findMany({
    where,
    orderBy: { settlementDate: "desc" },
  });

  const columns = [
    { key: "batchNumber", header: "Batch #" },
    { key: "settlementDate", header: "Settlement Date", formatter: formatDate },
    { key: "status", header: "Status" },
    { key: "currency", header: "Currency" },
    { key: "totalAmount", header: "Total Amount", formatter: formatAmount },
    { key: "feeAmount", header: "Fees", formatter: formatAmount },
    { key: "netAmount", header: "Net Amount", formatter: formatAmount },
    { key: "itemCount", header: "Item Count" },
    { key: "processedAt", header: "Processed", formatter: formatDate },
  ];

  if (options.format === "json") {
    return {
      data: JSON.stringify(settlements, null, 2),
      filename: `settlements_${Date.now()}.json`,
      mimeType: "application/json",
      rowCount: settlements.length,
    };
  }

  const csv = arrayToCSV(settlements, columns);

  return {
    data: csv,
    filename: `settlements_${Date.now()}.csv`,
    mimeType: "text/csv",
    rowCount: settlements.length,
  };
}
