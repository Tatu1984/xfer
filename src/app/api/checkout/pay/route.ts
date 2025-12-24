import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { successResponse, errorResponse, calculateFee } from "@/lib/api-utils";
import { z } from "zod";
import { generateReferenceId } from "@/lib/utils";

const paymentSchema = z.object({
  orderId: z.string(),
  paymentType: z.enum(["wallet", "card", "bank"]),
  walletId: z.string().optional(),
  paymentMethodId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("status" in authResult) {
      return errorResponse(authResult.error, authResult.status);
    }

    const body = await request.json();
    const validated = paymentSchema.parse(body);

    // Get the order
    const order = await prisma.order.findFirst({
      where: {
        id: validated.orderId,
        status: "PENDING",
      },
      include: {
        merchant: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse("Order not found or already processed", 404);
    }

    const orderTotal = Number(order.total);
    const fee = calculateFee(orderTotal, "PAYMENT");
    const netAmount = orderTotal - fee;

    // Process payment based on type
    if (validated.paymentType === "wallet") {
      if (!validated.walletId) {
        return errorResponse("Wallet ID required", 400);
      }

      // Get buyer's wallet
      const buyerWallet = await prisma.wallet.findFirst({
        where: {
          id: validated.walletId,
          userId: authResult.id,
          currency: order.currency,
        },
      });

      if (!buyerWallet) {
        return errorResponse("Wallet not found", 404);
      }

      if (Number(buyerWallet.availableBalance) < orderTotal) {
        return errorResponse("Insufficient balance", 400);
      }

      // Get or create vendor's wallet
      let vendorWallet = await prisma.wallet.findFirst({
        where: {
          userId: order.merchant.userId,
          currency: order.currency,
        },
      });

      if (!vendorWallet) {
        vendorWallet = await prisma.wallet.create({
          data: {
            userId: order.merchant.userId,
            currency: order.currency,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
          },
        });
      }

      // Process the payment in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Deduct from buyer wallet
        await tx.wallet.update({
          where: { id: buyerWallet.id },
          data: {
            balance: { decrement: orderTotal },
            availableBalance: { decrement: orderTotal },
          },
        });

        // Add to vendor wallet (net amount after fee)
        await tx.wallet.update({
          where: { id: vendorWallet!.id },
          data: {
            balance: { increment: netAmount },
            availableBalance: { increment: netAmount },
          },
        });

        // Create transaction record for buyer (outgoing)
        const transaction = await tx.transaction.create({
          data: {
            referenceId: generateReferenceId("PAY"),
            type: "PAYMENT",
            status: "COMPLETED",
            senderId: authResult.id,
            receiverId: order.merchant.userId,
            walletId: buyerWallet.id,
            amount: (orderTotal),
            currency: order.currency,
            fee: (fee),
            netAmount: (netAmount),
            description: `Payment for order ${order.orderNumber}`,
            orderId: order.id,
            processedAt: new Date(),
          },
        });

        // Create ledger entries
        await tx.ledgerEntry.create({
          data: {
            walletId: buyerWallet.id,
            transactionId: transaction.id,
            entryType: "debit",
            amount: (orderTotal),
            balanceBefore: buyerWallet.balance,
            balanceAfter: (Number(buyerWallet.balance) - orderTotal),
            description: `Payment for order ${order.orderNumber}`,
            reference: transaction.referenceId,
          },
        });

        await tx.ledgerEntry.create({
          data: {
            walletId: vendorWallet!.id,
            transactionId: transaction.id,
            entryType: "credit",
            amount: (netAmount),
            balanceBefore: vendorWallet!.balance,
            balanceAfter: (Number(vendorWallet!.balance) + netAmount),
            description: `Payment received for order ${order.orderNumber}`,
            reference: transaction.referenceId,
          },
        });

        // Update order status
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CAPTURED",
            capturedAmount: (orderTotal),
          },
        });

        return { transaction, order: updatedOrder };
      });

      return successResponse({
        success: true,
        transaction: {
          id: result.transaction.id,
          referenceId: result.transaction.referenceId,
          amount: Number(result.transaction.amount),
          fee: Number(result.transaction.fee),
          status: result.transaction.status,
        },
        order: {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
        },
      });
    } else {
      // For card/bank payments
      if (!validated.paymentMethodId) {
        return errorResponse("Payment method required", 400);
      }

      const paymentMethod = await prisma.paymentMethod.findFirst({
        where: {
          id: validated.paymentMethodId,
          userId: authResult.id,
          status: "VERIFIED",
        },
      });

      if (!paymentMethod) {
        return errorResponse("Invalid payment method", 400);
      }

      // Get or create vendor's wallet
      let vendorWallet = await prisma.wallet.findFirst({
        where: {
          userId: order.merchant.userId,
          currency: order.currency,
        },
      });

      if (!vendorWallet) {
        vendorWallet = await prisma.wallet.create({
          data: {
            userId: order.merchant.userId,
            currency: order.currency,
            balance: 0,
            availableBalance: 0,
            pendingBalance: 0,
          },
        });
      }

      // Process the payment
      const result = await prisma.$transaction(async (tx) => {
        // Add to vendor wallet
        await tx.wallet.update({
          where: { id: vendorWallet!.id },
          data: {
            balance: { increment: netAmount },
            availableBalance: { increment: netAmount },
          },
        });

        // Create transaction record
        const transaction = await tx.transaction.create({
          data: {
            referenceId: generateReferenceId("PAY"),
            type: "PAYMENT",
            status: "COMPLETED",
            senderId: authResult.id,
            receiverId: order.merchant.userId,
            walletId: vendorWallet!.id,
            paymentMethodId: paymentMethod.id,
            amount: (orderTotal),
            currency: order.currency,
            fee: (fee),
            netAmount: (netAmount),
            description: `Payment for order ${order.orderNumber}`,
            orderId: order.id,
            processedAt: new Date(),
          },
        });

        // Create vendor ledger entry
        await tx.ledgerEntry.create({
          data: {
            walletId: vendorWallet!.id,
            transactionId: transaction.id,
            entryType: "credit",
            amount: (netAmount),
            balanceBefore: vendorWallet!.balance,
            balanceAfter: (Number(vendorWallet!.balance) + netAmount),
            description: `Payment received for order ${order.orderNumber}`,
            reference: transaction.referenceId,
          },
        });

        // Update order status
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: "CAPTURED",
            capturedAmount: (orderTotal),
          },
        });

        return { transaction, order: updatedOrder };
      });

      return successResponse({
        success: true,
        transaction: {
          id: result.transaction.id,
          referenceId: result.transaction.referenceId,
          amount: Number(result.transaction.amount),
          fee: Number(result.transaction.fee),
          status: result.transaction.status,
        },
        order: {
          id: result.order.id,
          orderNumber: result.order.orderNumber,
          status: result.order.status,
        },
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(error.issues[0].message, 400);
    }
    console.error("Checkout payment error:", error);
    return errorResponse("Payment failed", 500);
  }
}
