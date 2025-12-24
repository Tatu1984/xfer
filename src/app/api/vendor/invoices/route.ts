import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const invoiceSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  currency: z.string().default("USD"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  taxRate: z.number().min(0).max(100).optional(),
});

// GET - List vendor's invoices
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
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status && status !== "all") {
      where.status = status.toUpperCase();
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.invoice.count({ where }),
    ]);

    // Calculate summary stats
    const stats = await prisma.invoice.groupBy({
      by: ["status"],
      where: { businessId: business.id },
      _sum: { total: true },
      _count: true,
    });

    return NextResponse.json({
      invoices,
      stats,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + invoices.length < total,
      },
    });
  } catch (error) {
    console.error("Get invoices error:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}

// POST - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const data = invoiceSchema.parse(body);

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const taxAmount = data.taxRate ? subtotal * (data.taxRate / 100) : 0;
    const total = subtotal + taxAmount;

    // Generate invoice number
    const lastInvoice = await prisma.invoice.findFirst({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });
    const nextNumber = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.replace(/\D/g, "") || "0") + 1
      : 1;
    const invoiceNumber = `INV${String(nextNumber).padStart(5, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        businessId: business.id,
        customerEmail: data.customerEmail,
        customerName: data.customerName,
        items: data.items,
        subtotal,
        tax: taxAmount,
        total,
        currency: data.currency,
        status: "DRAFT",
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: data.notes,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create invoice error:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

// PATCH - Update invoice (send, mark paid, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["VENDOR"]);

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const { id, action, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId: business.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "send":
        if (invoice.status !== "DRAFT") {
          return NextResponse.json({ error: "Only draft invoices can be sent" }, { status: 400 });
        }
        updateData = { status: "SENT", sentAt: new Date() };
        // In production, send email here
        break;

      case "mark_paid":
        if (!["SENT", "VIEWED", "OVERDUE", "PARTIAL"].includes(invoice.status)) {
          return NextResponse.json({ error: "Cannot mark this invoice as paid" }, { status: 400 });
        }
        updateData = { status: "PAID", paidAt: new Date(), paidAmount: invoice.total };
        break;

      case "cancel":
        if (invoice.status === "PAID") {
          return NextResponse.json({ error: "Cannot cancel a paid invoice" }, { status: 400 });
        }
        updateData = { status: "CANCELLED" };
        break;

      case "mark_viewed":
        if (invoice.status === "SENT") {
          updateData = { status: "VIEWED", viewedAt: new Date() };
        }
        break;

      default:
        updateData = updates;
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update invoice error:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}

// DELETE - Delete a draft invoice
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
      return NextResponse.json({ error: "Invoice ID is required" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: user.id },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { id, businessId: business.id },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status !== "DRAFT") {
      return NextResponse.json({ error: "Only draft invoices can be deleted" }, { status: 400 });
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete invoice error:", error);
    return NextResponse.json({ error: "Failed to delete invoice" }, { status: 500 });
  }
}
