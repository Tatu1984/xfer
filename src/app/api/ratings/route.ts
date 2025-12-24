import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-utils";

const ratingSchema = z.object({
  transactionId: z.string(),
  rating: z.number().min(1).max(5),
  review: z.string().optional(),
  itemAccuracy: z.number().min(1).max(5).optional(),
  communication: z.number().min(1).max(5).optional(),
  shippingSpeed: z.number().min(1).max(5).optional(),
});

const responseSchema = z.object({
  ratingId: z.string(),
  response: z.string().max(500),
});

// Calculate and update seller score
async function updateSellerScore(sellerId: string) {
  // Get all ratings for this seller
  const ratings = await prisma.sellerRating.findMany({
    where: { sellerId, isVisible: true },
  });

  if (ratings.length === 0) return;

  const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;

  // Get dispute and chargeback data
  const [totalSales, disputes, chargebacks, refunds] = await Promise.all([
    prisma.transaction.count({
      where: { receiverId: sellerId, type: "PAYMENT", status: "COMPLETED" },
    }),
    prisma.dispute.count({
      where: { respondentId: sellerId },
    }),
    prisma.chargeback.count({
      where: {
        transactionId: {
          in: (await prisma.transaction.findMany({
            where: { receiverId: sellerId },
            select: { id: true },
          })).map((t) => t.id),
        },
      },
    }),
    prisma.transaction.count({
      where: { receiverId: sellerId, type: "REFUND" },
    }),
  ]);

  const disputeRate = totalSales > 0 ? disputes / totalSales : 0;
  const chargebackRate = totalSales > 0 ? chargebacks / totalSales : 0;
  const refundRate = totalSales > 0 ? refunds / totalSales : 0;

  // Calculate seller level
  let sellerLevel = "NEW";
  if (totalSales >= 100 && averageRating >= 4.8 && disputeRate < 0.01) {
    sellerLevel = "PLATINUM";
  } else if (totalSales >= 50 && averageRating >= 4.5 && disputeRate < 0.02) {
    sellerLevel = "GOLD";
  } else if (totalSales >= 20 && averageRating >= 4.0 && disputeRate < 0.03) {
    sellerLevel = "SILVER";
  } else if (totalSales >= 10 && averageRating >= 3.5) {
    sellerLevel = "BRONZE";
  }

  await prisma.sellerScore.upsert({
    where: { sellerId },
    create: {
      sellerId,
      averageRating,
      totalRatings: ratings.length,
      totalSales,
      disputeRate,
      chargebackRate,
      refundRate,
      sellerLevel,
    },
    update: {
      averageRating,
      totalRatings: ratings.length,
      totalSales,
      disputeRate,
      chargebackRate,
      refundRate,
      sellerLevel,
      lastCalculated: new Date(),
    },
  });
}

// GET - Get seller ratings
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sellerId = searchParams.get("sellerId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!sellerId) {
      return NextResponse.json({ error: "Seller ID required" }, { status: 400 });
    }

    const [ratings, sellerScore, total] = await Promise.all([
      prisma.sellerRating.findMany({
        where: { sellerId, isVisible: true },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.sellerScore.findUnique({
        where: { sellerId },
      }),
      prisma.sellerRating.count({
        where: { sellerId, isVisible: true },
      }),
    ]);

    // Get rating distribution
    const distribution = await prisma.sellerRating.groupBy({
      by: ["rating"],
      where: { sellerId, isVisible: true },
      _count: true,
    });

    return NextResponse.json({
      ratings,
      sellerScore,
      distribution: Object.fromEntries(
        [1, 2, 3, 4, 5].map((r) => [
          r,
          distribution.find((d) => d.rating === r)?._count || 0,
        ])
      ),
      pagination: { total, limit, offset, hasMore: offset + ratings.length < total },
    });
  } catch (error) {
    console.error("Get ratings error:", error);
    return NextResponse.json({ error: "Failed to fetch ratings" }, { status: 500 });
  }
}

// POST - Create rating
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const data = ratingSchema.parse(body);

    // Check if rating already exists
    const existing = await prisma.sellerRating.findUnique({
      where: { transactionId: data.transactionId },
    });

    if (existing) {
      return NextResponse.json({ error: "Rating already exists for this transaction" }, { status: 400 });
    }

    // Get transaction and verify buyer
    const transaction = await prisma.transaction.findUnique({
      where: { id: data.transactionId },
    });

    if (!transaction) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
    }

    if (transaction.senderId !== user.id) {
      return NextResponse.json({ error: "You can only rate transactions you made" }, { status: 403 });
    }

    if (!transaction.receiverId) {
      return NextResponse.json({ error: "Transaction has no seller" }, { status: 400 });
    }

    // Transaction must be completed
    if (transaction.status !== "COMPLETED") {
      return NextResponse.json({ error: "Can only rate completed transactions" }, { status: 400 });
    }

    // Create rating
    const rating = await prisma.sellerRating.create({
      data: {
        sellerId: transaction.receiverId,
        buyerId: user.id,
        transactionId: data.transactionId,
        rating: data.rating,
        review: data.review,
        itemAccuracy: data.itemAccuracy,
        communication: data.communication,
        shippingSpeed: data.shippingSpeed,
      },
    });

    // Update seller score
    await updateSellerScore(transaction.receiverId);

    // Notify seller
    await prisma.notification.create({
      data: {
        userId: transaction.receiverId,
        type: "system",
        title: "New Rating Received",
        message: `You received a ${data.rating}-star rating`,
        data: { ratingId: rating.id },
      },
    });

    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Create rating error:", error);
    return NextResponse.json({ error: "Failed to create rating" }, { status: 500 });
  }
}

// PUT - Seller response to rating
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { ratingId, response } = responseSchema.parse(body);

    const rating = await prisma.sellerRating.findUnique({
      where: { id: ratingId },
    });

    if (!rating) {
      return NextResponse.json({ error: "Rating not found" }, { status: 404 });
    }

    if (rating.sellerId !== user.id) {
      return NextResponse.json({ error: "You can only respond to your own ratings" }, { status: 403 });
    }

    if (rating.sellerResponse) {
      return NextResponse.json({ error: "Already responded to this rating" }, { status: 400 });
    }

    const updated = await prisma.sellerRating.update({
      where: { id: ratingId },
      data: {
        sellerResponse: response,
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ rating: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Respond to rating error:", error);
    return NextResponse.json({ error: "Failed to respond" }, { status: 500 });
  }
}
