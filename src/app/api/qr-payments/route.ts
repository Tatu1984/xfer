import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth, generateReferenceId } from "@/lib/api-utils";

const createQRSchema = z.object({
  type: z.enum(["receive", "pay", "merchant"]),
  amount: z.number().positive().optional(),
  currency: z.string().length(3).default("USD"),
  description: z.string().optional(),
  usageLimit: z.number().positive().optional(),
  expiresInMinutes: z.number().positive().optional(),
});

const payQRSchema = z.object({
  qrCode: z.string(),
  amount: z.number().positive().optional(),
});

// Generate unique QR code
function generateQRCode(): string {
  return `XFR${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

// GET - List user's QR codes
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const active = searchParams.get("active");

    const where: Record<string, unknown> = { userId: user.id };
    if (type) where.type = type;
    if (active === "true") {
      where.isActive = true;
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    const qrCodes = await prisma.qRPayment.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ qrCodes });
  } catch (error) {
    console.error("Get QR codes error:", error);
    return NextResponse.json({ error: "Failed to fetch QR codes" }, { status: 500 });
  }
}

// POST - Create QR code
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const data = createQRSchema.parse(body);

    const qrCode = generateQRCode();
    const expiresAt = data.expiresInMinutes
      ? new Date(Date.now() + data.expiresInMinutes * 60 * 1000)
      : null;

    const qrPayment = await prisma.qRPayment.create({
      data: {
        userId: user.id,
        qrCode,
        type: data.type,
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        usageLimit: data.usageLimit,
        expiresAt,
      },
    });

    // Generate QR code URL (would use a QR library in production)
    const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pay/${qrCode}`;

    return NextResponse.json({
      success: true,
      qrPayment: {
        ...qrPayment,
        qrUrl,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create QR code error:", error);
    return NextResponse.json({ error: "Failed to create QR code" }, { status: 500 });
  }
}

// PUT - Pay via QR code
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { qrCode, amount: payAmount } = payQRSchema.parse(body);

    // Find QR code
    const qrPayment = await prisma.qRPayment.findUnique({
      where: { qrCode },
    });

    if (!qrPayment) {
      return NextResponse.json({ error: "Invalid QR code" }, { status: 404 });
    }

    if (!qrPayment.isActive) {
      return NextResponse.json({ error: "QR code is inactive" }, { status: 400 });
    }

    if (qrPayment.expiresAt && qrPayment.expiresAt < new Date()) {
      return NextResponse.json({ error: "QR code has expired" }, { status: 400 });
    }

    if (qrPayment.usageLimit && qrPayment.usageCount >= qrPayment.usageLimit) {
      return NextResponse.json({ error: "QR code usage limit reached" }, { status: 400 });
    }

    if (qrPayment.userId === user.id) {
      return NextResponse.json({ error: "Cannot pay yourself" }, { status: 400 });
    }

    // Determine amount
    const amount = qrPayment.amount ? Number(qrPayment.amount) : payAmount;
    if (!amount) {
      return NextResponse.json({ error: "Amount required" }, { status: 400 });
    }

    // Get sender wallet
    const senderWallet = await prisma.wallet.findFirst({
      where: { userId: user.id, currency: qrPayment.currency, isActive: true },
    });

    if (!senderWallet || Number(senderWallet.availableBalance) < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // Get receiver wallet
    let receiverWallet = await prisma.wallet.findFirst({
      where: { userId: qrPayment.userId, currency: qrPayment.currency, isActive: true },
    });

    if (!receiverWallet) {
      receiverWallet = await prisma.wallet.create({
        data: {
          userId: qrPayment.userId,
          currency: qrPayment.currency,
          isDefault: false,
        },
      });
    }

    // Process payment
    const referenceId = generateReferenceId("QRP");

    const result = await prisma.$transaction(async (tx) => {
      // Create transaction
      const transaction = await tx.transaction.create({
        data: {
          referenceId,
          type: "TRANSFER_OUT",
          status: "COMPLETED",
          senderId: user.id,
          receiverId: qrPayment.userId,
          walletId: senderWallet.id,
          amount,
          currency: qrPayment.currency,
          fee: 0,
          netAmount: amount,
          description: qrPayment.description || "QR Payment",
          processedAt: new Date(),
        },
      });

      // Update sender wallet
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: { availableBalance: { decrement: amount } },
      });

      // Update receiver wallet
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: { availableBalance: { increment: amount } },
      });

      // Update QR usage count
      await tx.qRPayment.update({
        where: { id: qrPayment.id },
        data: { usageCount: { increment: 1 } },
      });

      // Create ledger entries
      await tx.ledgerEntry.createMany({
        data: [
          {
            walletId: senderWallet.id,
            transactionId: transaction.id,
            entryType: "debit",
            amount,
            balanceBefore: senderWallet.availableBalance,
            balanceAfter: Number(senderWallet.availableBalance) - amount,
            description: "QR Payment sent",
            reference: referenceId,
          },
          {
            walletId: receiverWallet.id,
            transactionId: transaction.id,
            entryType: "credit",
            amount,
            balanceBefore: receiverWallet.availableBalance,
            balanceAfter: Number(receiverWallet.availableBalance) + amount,
            description: "QR Payment received",
            reference: referenceId,
          },
        ],
      });

      return transaction;
    });

    // Create notifications
    await prisma.notification.createMany({
      data: [
        {
          userId: user.id,
          type: "transaction",
          title: "Payment Sent",
          message: `You sent ${qrPayment.currency} ${amount.toFixed(2)} via QR payment`,
          data: { transactionId: result.id },
        },
        {
          userId: qrPayment.userId,
          type: "transaction",
          title: "Payment Received",
          message: `You received ${qrPayment.currency} ${amount.toFixed(2)} via QR payment`,
          data: { transactionId: result.id },
        },
      ],
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: result.id,
        referenceId: result.referenceId,
        amount,
        currency: qrPayment.currency,
        status: result.status,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("QR payment error:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}

// DELETE - Deactivate QR code
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "QR code ID required" }, { status: 400 });
    }

    const qrPayment = await prisma.qRPayment.findFirst({
      where: { id, userId: user.id },
    });

    if (!qrPayment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.qRPayment.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete QR code error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
