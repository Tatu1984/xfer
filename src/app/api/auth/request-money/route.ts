import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

const requestMoneySchema = z.object({
  email: z.string().email("Invalid email address"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().default("USD"),
  note: z.string().optional(),
});

// GET - List money requests for the current user
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {
      OR: [
        { requesterId: user.id },
        { requesteeId: user.id },
      ],
    };

    if (status) {
      where.status = status;
    }

    const [requests, total] = await Promise.all([
      prisma.moneyRequest.findMany({
        where,
        include: {
          requester: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          requestee: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.moneyRequest.count({ where }),
    ]);

    return NextResponse.json({
      requests,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + requests.length < total,
      },
    });
  } catch (error) {
    console.error("Get money requests error:", error);
    return NextResponse.json(
      { error: "Failed to fetch money requests" },
      { status: 500 }
    );
  }
}

// POST - Create a new money request
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const { email, amount, currency, note } = requestMoneySchema.parse(body);

    // Find the requestee by email
    const requestee = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!requestee) {
      return NextResponse.json(
        { error: "User not found with this email" },
        { status: 404 }
      );
    }

    if (requestee.id === user.id) {
      return NextResponse.json(
        { error: "You cannot request money from yourself" },
        { status: 400 }
      );
    }

    // Create the money request
    const moneyRequest = await prisma.moneyRequest.create({
      data: {
        requesterId: user.id,
        requesteeId: requestee.id,
        amount,
        currency,
        note: note || null,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      include: {
        requester: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        requestee: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    // Create notification for requestee
    await prisma.notification.create({
      data: {
        userId: requestee.id,
        type: "MONEY_REQUEST",
        title: "Money Request Received",
        message: `${user.email} has requested ${currency} ${amount.toFixed(2)}`,
        data: {
          requestId: moneyRequest.id,
          amount,
          currency,
          requesterEmail: user.email,
          actionUrl: `/dashboard/request`,
        },
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "MONEY_REQUEST_CREATED",
        entityType: "MONEY_REQUEST",
        entityId: moneyRequest.id,
        details: {
          requesteeEmail: requestee.email,
          amount,
          currency,
        },
      },
    });

    return NextResponse.json(moneyRequest, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Create money request error:", error);
    return NextResponse.json(
      { error: "Failed to create money request" },
      { status: 500 }
    );
  }
}

// PATCH - Update a money request (pay, decline, cancel)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth();

    // Type guard for successful auth
    if (!authResult || typeof authResult !== "object" || !("id" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = authResult as { id: string; email: string };
    const body = await request.json();
    const { requestId, action } = body;

    if (!requestId || !action) {
      return NextResponse.json(
        { error: "Request ID and action are required" },
        { status: 400 }
      );
    }

    const moneyRequest = await prisma.moneyRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: true,
        requestee: true,
      },
    });

    if (!moneyRequest) {
      return NextResponse.json(
        { error: "Money request not found" },
        { status: 404 }
      );
    }

    if (moneyRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "This request has already been processed" },
        { status: 400 }
      );
    }

    switch (action) {
      case "pay": {
        // Only requestee can pay
        if (moneyRequest.requesteeId !== user.id) {
          return NextResponse.json(
            { error: "Only the recipient of the request can pay" },
            { status: 403 }
          );
        }

        // Check wallet balance
        const wallet = await prisma.wallet.findFirst({
          where: {
            userId: user.id,
            currency: moneyRequest.currency,
            isActive: true,
          },
        });

        if (!wallet || wallet.availableBalance.toNumber() < moneyRequest.amount.toNumber()) {
          return NextResponse.json(
            { error: "Insufficient balance" },
            { status: 400 }
          );
        }

        // Process the payment using a transaction
        const result = await prisma.$transaction(async (tx) => {
          // Update requester's wallet (credit)
          const requesterWallet = await tx.wallet.findFirst({
            where: {
              userId: moneyRequest.requesterId,
              currency: moneyRequest.currency,
              isActive: true,
            },
          });

          if (!requesterWallet) {
            // Create wallet for requester if doesn't exist
            await tx.wallet.create({
              data: {
                userId: moneyRequest.requesterId,
                currency: moneyRequest.currency,
                balance: moneyRequest.amount,
                availableBalance: moneyRequest.amount,
              },
            });
          } else {
            await tx.wallet.update({
              where: { id: requesterWallet.id },
              data: {
                balance: { increment: moneyRequest.amount },
                availableBalance: { increment: moneyRequest.amount },
              },
            });
          }

          // Update payer's wallet (debit)
          await tx.wallet.update({
            where: { id: wallet.id },
            data: {
              balance: { decrement: moneyRequest.amount },
              availableBalance: { decrement: moneyRequest.amount },
            },
          });

          // Create transactions
          const senderTx = await tx.transaction.create({
            data: {
              type: "TRANSFER_OUT",
              status: "COMPLETED",
              amount: moneyRequest.amount,
              currency: moneyRequest.currency,
              senderId: user.id,
              receiverId: moneyRequest.requesterId,
              walletId: wallet.id,
              description: moneyRequest.note || "Money request payment",
              referenceId: `REQ-${moneyRequest.id}`,
              fee: 0,
              netAmount: moneyRequest.amount,
            },
          });

          // Update money request
          const updated = await tx.moneyRequest.update({
            where: { id: requestId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              transactionId: senderTx.id,
            },
          });

          return updated;
        });

        // Create notifications
        await prisma.notification.create({
          data: {
            userId: moneyRequest.requesterId,
            type: "PAYMENT_RECEIVED",
            title: "Payment Received",
            message: `${moneyRequest.requestee.email} paid your request of ${moneyRequest.currency} ${moneyRequest.amount}`,
            data: {
              actionUrl: `/dashboard/transactions`,
            },
          },
        });

        return NextResponse.json(result);
      }

      case "decline": {
        // Only requestee can decline
        if (moneyRequest.requesteeId !== user.id) {
          return NextResponse.json(
            { error: "Only the recipient can decline the request" },
            { status: 403 }
          );
        }

        const updated = await prisma.moneyRequest.update({
          where: { id: requestId },
          data: { status: "DECLINED" },
        });

        // Notify requester
        await prisma.notification.create({
          data: {
            userId: moneyRequest.requesterId,
            type: "MONEY_REQUEST",
            title: "Request Declined",
            message: `${moneyRequest.requestee.email} declined your money request`,
            data: {
              actionUrl: `/dashboard/request`,
            },
          },
        });

        return NextResponse.json(updated);
      }

      case "cancel": {
        // Only requester can cancel
        if (moneyRequest.requesterId !== user.id) {
          return NextResponse.json(
            { error: "Only the requester can cancel" },
            { status: 403 }
          );
        }

        const updated = await prisma.moneyRequest.update({
          where: { id: requestId },
          data: { status: "CANCELLED" },
        });

        return NextResponse.json(updated);
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Update money request error:", error);
    return NextResponse.json(
      { error: "Failed to update money request" },
      { status: 500 }
    );
  }
}
