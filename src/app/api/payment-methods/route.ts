import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  errorResponse,
  successResponse,
  prisma,
} from "@/lib/api-utils";

// GET /api/payment-methods - List user's payment methods
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { userId: user.id, status: { not: "REMOVED" } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return successResponse({
    paymentMethods: paymentMethods.map((pm) => ({
      id: pm.id,
      type: pm.type,
      status: pm.status,
      isDefault: pm.isDefault,
      // Bank details (masked)
      bankName: pm.bankName,
      accountType: pm.accountType,
      accountLast4: pm.accountLast4,
      // Card details (masked)
      cardBrand: pm.cardBrand,
      cardLast4: pm.cardLast4,
      cardExpMonth: pm.cardExpMonth,
      cardExpYear: pm.cardExpYear,
      createdAt: pm.createdAt,
      verifiedAt: pm.verifiedAt,
    })),
  });
}

// POST /api/payment-methods - Add a new payment method
const addBankSchema = z.object({
  type: z.literal("BANK_ACCOUNT"),
  bankName: z.string().min(1),
  bankCountry: z.string().length(2),
  accountType: z.enum(["checking", "savings"]),
  accountNumber: z.string().min(4),
  routingNumber: z.string().min(9).max(9),
  isDefault: z.boolean().optional(),
});

const addCardSchema = z.object({
  type: z.enum(["DEBIT_CARD", "CREDIT_CARD"]),
  cardNumber: z.string().min(13).max(19),
  cardExpMonth: z.number().min(1).max(12),
  cardExpYear: z.number().min(new Date().getFullYear()),
  cvv: z.string().length(3).or(z.string().length(4)),
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    postalCode: z.string(),
    country: z.string().length(2),
  }),
  isDefault: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();

    // Determine type and validate
    if (body.type === "BANK_ACCOUNT") {
      const data = addBankSchema.parse(body);

      // Check for duplicate
      const existing = await prisma.paymentMethod.findFirst({
        where: {
          userId: user.id,
          type: "BANK_ACCOUNT",
          accountLast4: data.accountNumber.slice(-4),
          routingNumber: data.routingNumber,
          status: { not: "REMOVED" },
        },
      });

      if (existing) {
        return errorResponse("This bank account is already linked", 400);
      }

      // If setting as default, unset others
      if (data.isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      const paymentMethod = await prisma.paymentMethod.create({
        data: {
          userId: user.id,
          type: "BANK_ACCOUNT",
          status: "PENDING_VERIFICATION",
          bankName: data.bankName,
          bankCountry: data.bankCountry,
          accountType: data.accountType,
          accountLast4: data.accountNumber.slice(-4),
          routingNumber: data.routingNumber,
          isDefault: data.isDefault || false,
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "payment_method_added",
          entityType: "payment_method",
          entityId: paymentMethod.id,
          details: { type: "BANK_ACCOUNT", bankName: data.bankName },
        },
      });

      return successResponse({
        id: paymentMethod.id,
        type: paymentMethod.type,
        status: paymentMethod.status,
        bankName: paymentMethod.bankName,
        accountLast4: paymentMethod.accountLast4,
        message: "Bank account added. Verification in progress.",
      }, 201);
    } else {
      const data = addCardSchema.parse(body);

      // Determine card brand from number
      const cardBrand = getCardBrand(data.cardNumber);
      const cardLast4 = data.cardNumber.slice(-4);

      // Check for duplicate
      const existing = await prisma.paymentMethod.findFirst({
        where: {
          userId: user.id,
          type: data.type,
          cardLast4,
          cardExpMonth: data.cardExpMonth,
          cardExpYear: data.cardExpYear,
          status: { not: "REMOVED" },
        },
      });

      if (existing) {
        return errorResponse("This card is already linked", 400);
      }

      // If setting as default, unset others
      if (data.isDefault) {
        await prisma.paymentMethod.updateMany({
          where: { userId: user.id, isDefault: true },
          data: { isDefault: false },
        });
      }

      const paymentMethod = await prisma.paymentMethod.create({
        data: {
          userId: user.id,
          type: data.type,
          status: "VERIFIED", // Cards are verified instantly in this demo
          cardBrand,
          cardLast4,
          cardExpMonth: data.cardExpMonth,
          cardExpYear: data.cardExpYear,
          cardFingerprint: generateFingerprint(data.cardNumber),
          billingAddress: data.billingAddress,
          isDefault: data.isDefault || false,
          verifiedAt: new Date(),
        },
      });

      // Log activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: "payment_method_added",
          entityType: "payment_method",
          entityId: paymentMethod.id,
          details: { type: data.type, cardBrand, cardLast4 },
        },
      });

      return successResponse({
        id: paymentMethod.id,
        type: paymentMethod.type,
        status: paymentMethod.status,
        cardBrand,
        cardLast4,
        message: "Card added successfully.",
      }, 201);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Payment method error:", error);
    return errorResponse("Failed to add payment method", 500);
  }
}

function getCardBrand(cardNumber: string): string {
  const num = cardNumber.replace(/\D/g, "");
  if (/^4/.test(num)) return "visa";
  if (/^5[1-5]/.test(num)) return "mastercard";
  if (/^3[47]/.test(num)) return "amex";
  if (/^6(?:011|5)/.test(num)) return "discover";
  return "unknown";
}

function generateFingerprint(cardNumber: string): string {
  // In production, this would use proper tokenization
  const hash = cardNumber
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return `fp_${hash.toString(36)}${Date.now().toString(36)}`;
}

// DELETE /api/payment-methods - Remove a payment method
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if ("error" in authResult) {
    return errorResponse(authResult.error, authResult.status);
  }

  const user = authResult.user as { id: string };
  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get("id");

  if (!id) {
    return errorResponse("Payment method ID required", 400);
  }

  const paymentMethod = await prisma.paymentMethod.findFirst({
    where: { id, userId: user.id, status: { not: "REMOVED" } },
  });

  if (!paymentMethod) {
    return errorResponse("Payment method not found", 404);
  }

  await prisma.paymentMethod.update({
    where: { id },
    data: { status: "REMOVED", isDefault: false },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "payment_method_removed",
      entityType: "payment_method",
      entityId: id,
    },
  });

  return successResponse({ success: true });
}
