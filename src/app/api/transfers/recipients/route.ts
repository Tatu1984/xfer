import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/transfers/recipients - Get recent recipients for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "5");

    // Get recent unique recipients from outgoing transfers
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        senderId: session.user.id,
        type: "TRANSFER_OUT",
        status: "COMPLETED",
        receiverId: { not: null },
      },
      select: {
        receiverId: true,
        createdAt: true,
        receiver: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Get more to filter duplicates
    });

    // Deduplicate by receiver ID and keep only the most recent
    const seenIds = new Set<string>();
    const uniqueRecipients = [];

    for (const tx of recentTransactions) {
      if (tx.receiverId && tx.receiver && !seenIds.has(tx.receiverId)) {
        seenIds.add(tx.receiverId);
        uniqueRecipients.push({
          id: tx.receiver.id,
          email: tx.receiver.email,
          name: tx.receiver.displayName ||
                `${tx.receiver.firstName || ""} ${tx.receiver.lastName || ""}`.trim() ||
                tx.receiver.email.split("@")[0],
          avatar: tx.receiver.avatarUrl,
        });

        if (uniqueRecipients.length >= limit) {
          break;
        }
      }
    }

    return NextResponse.json({ recipients: uniqueRecipients });
  } catch (error) {
    console.error("Get recipients error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 }
    );
  }
}
