import { prisma } from "@/lib/prisma";

export interface TaxBreakdown {
  subtotal: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  taxType: string;
  taxName: string;
  total: number;
}

// Calculate tax based on location
export async function calculateTax(
  subtotal: number,
  country: string,
  state?: string,
  city?: string,
  postalCode?: string
): Promise<TaxBreakdown> {
  // Find applicable tax rate (most specific first)
  let taxRate = await prisma.taxRate.findFirst({
    where: {
      country,
      state: state || null,
      city: city || null,
      postalCode: postalCode || null,
      isActive: true,
    },
    orderBy: [
      { postalCode: "desc" },
      { city: "desc" },
      { state: "desc" },
    ],
  });

  // Fall back to less specific rates
  if (!taxRate && postalCode) {
    taxRate = await prisma.taxRate.findFirst({
      where: { country, state, city, postalCode: null, isActive: true },
    });
  }

  if (!taxRate && city) {
    taxRate = await prisma.taxRate.findFirst({
      where: { country, state, city: null, postalCode: null, isActive: true },
    });
  }

  if (!taxRate && state) {
    taxRate = await prisma.taxRate.findFirst({
      where: { country, state: null, city: null, postalCode: null, isActive: true },
    });
  }

  if (!taxRate) {
    // No tax
    return {
      subtotal,
      taxableAmount: subtotal,
      taxRate: 0,
      taxAmount: 0,
      taxType: "none",
      taxName: "No Tax",
      total: subtotal,
    };
  }

  const rate = Number(taxRate.rate);
  const taxAmount = Math.round(subtotal * rate * 100) / 100;

  return {
    subtotal,
    taxableAmount: subtotal,
    taxRate: rate,
    taxAmount,
    taxType: taxRate.taxType,
    taxName: taxRate.name,
    total: subtotal + taxAmount,
  };
}

// Seed default tax rates
export async function seedDefaultTaxRates() {
  const defaultRates = [
    // US States
    { country: "US", state: "CA", taxType: "sales_tax", rate: 0.0725, name: "California Sales Tax" },
    { country: "US", state: "NY", taxType: "sales_tax", rate: 0.08, name: "New York Sales Tax" },
    { country: "US", state: "TX", taxType: "sales_tax", rate: 0.0625, name: "Texas Sales Tax" },
    { country: "US", state: "FL", taxType: "sales_tax", rate: 0.06, name: "Florida Sales Tax" },
    { country: "US", state: "WA", taxType: "sales_tax", rate: 0.065, name: "Washington Sales Tax" },
    { country: "US", state: "OR", taxType: "sales_tax", rate: 0, name: "Oregon (No Sales Tax)" },
    { country: "US", state: "DE", taxType: "sales_tax", rate: 0, name: "Delaware (No Sales Tax)" },
    { country: "US", state: "MT", taxType: "sales_tax", rate: 0, name: "Montana (No Sales Tax)" },
    { country: "US", state: "NH", taxType: "sales_tax", rate: 0, name: "New Hampshire (No Sales Tax)" },

    // European VAT
    { country: "GB", taxType: "vat", rate: 0.2, name: "UK VAT" },
    { country: "DE", taxType: "vat", rate: 0.19, name: "Germany VAT" },
    { country: "FR", taxType: "vat", rate: 0.2, name: "France VAT" },
    { country: "IT", taxType: "vat", rate: 0.22, name: "Italy VAT" },
    { country: "ES", taxType: "vat", rate: 0.21, name: "Spain VAT" },
    { country: "NL", taxType: "vat", rate: 0.21, name: "Netherlands VAT" },

    // Other countries
    { country: "CA", taxType: "gst", rate: 0.05, name: "Canada GST" },
    { country: "AU", taxType: "gst", rate: 0.1, name: "Australia GST" },
    { country: "JP", taxType: "consumption_tax", rate: 0.1, name: "Japan Consumption Tax" },
    { country: "SG", taxType: "gst", rate: 0.08, name: "Singapore GST" },
  ];

  for (const rate of defaultRates) {
    await prisma.taxRate.upsert({
      where: {
        id: `default-${rate.country}-${rate.state || "national"}`,
      },
      create: {
        id: `default-${rate.country}-${rate.state || "national"}`,
        ...rate,
      },
      update: rate,
    });
  }
}

// Generate tax documents for a user
export async function generateTaxDocument(
  userId: string,
  taxYear: number,
  documentType: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      country: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Get transactions for the tax year
  const startOfYear = new Date(taxYear, 0, 1);
  const endOfYear = new Date(taxYear, 11, 31, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
      receiverId: userId,
      type: "PAYMENT",
      status: "COMPLETED",
      createdAt: { gte: startOfYear, lte: endOfYear },
    },
    select: { amount: true },
  });

  const grossAmount = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

  // Check thresholds
  if (documentType === "1099K" && (grossAmount < 600 || transactions.length < 200)) {
    // Below threshold, may not require 1099-K
  }

  // Create or update tax document
  const taxDoc = await prisma.taxDocument.upsert({
    where: {
      userId_taxYear_documentType: {
        userId,
        taxYear,
        documentType,
      },
    },
    create: {
      userId,
      taxYear,
      documentType,
      recipientName: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      recipientAddress: {
        line1: user.addressLine1,
        line2: user.addressLine2,
        city: user.city,
        state: user.state,
        postalCode: user.postalCode,
        country: user.country,
      },
      grossAmount,
      transactionCount: transactions.length,
      status: "PENDING",
    },
    update: {
      grossAmount,
      transactionCount: transactions.length,
      status: "PENDING",
    },
  });

  return taxDoc.id;
}

// Get tax summary for a user
export async function getTaxSummary(userId: string, taxYear: number) {
  const startOfYear = new Date(taxYear, 0, 1);
  const endOfYear = new Date(taxYear, 11, 31, 23, 59, 59);

  const [received, sent, fees] = await Promise.all([
    prisma.transaction.aggregate({
      where: {
        receiverId: userId,
        status: "COMPLETED",
        createdAt: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        senderId: userId,
        status: "COMPLETED",
        createdAt: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: "COMPLETED",
        createdAt: { gte: startOfYear, lte: endOfYear },
      },
      _sum: { fee: true },
    }),
  ]);

  // Get tax documents
  const documents = await prisma.taxDocument.findMany({
    where: { userId, taxYear },
  });

  return {
    taxYear,
    received: {
      amount: Number(received._sum.amount || 0),
      count: received._count,
    },
    sent: {
      amount: Number(sent._sum.amount || 0),
      count: sent._count,
    },
    totalFees: Number(fees._sum.fee || 0),
    documents: documents.map((d) => ({
      type: d.documentType,
      status: d.status,
      grossAmount: Number(d.grossAmount),
      generatedAt: d.generatedAt,
    })),
  };
}
