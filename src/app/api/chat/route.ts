import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";

const messageSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
  attachments: z.array(z.string()).optional(),
});

// GET - Get chat session(s)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (sessionId) {
      // Get specific session with messages
      const session = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          OR: [{ userId: user.id }, { agentId: user.id }],
        },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      return NextResponse.json({ session });
    }

    // Get all sessions for user
    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.id },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1, // Last message only
        },
      },
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("Get chat error:", error);
    return NextResponse.json({ error: "Failed to fetch chat" }, { status: 500 });
  }
}

// POST - Send message / Start session
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { sessionId, message, attachments } = messageSchema.parse(body);

    let session: { id: string; userId: string; agentId: string | null; status: string } | null = null;

    if (sessionId) {
      // Add message to existing session
      session = await prisma.chatSession.findFirst({
        where: {
          id: sessionId,
          OR: [{ userId: user.id }, { agentId: user.id }],
          status: { not: "CLOSED" },
        },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found or closed" }, { status: 404 });
      }
    } else {
      // Create new session
      session = await prisma.chatSession.create({
        data: {
          userId: user.id,
          status: "WAITING",
        },
      });

      // Notify available agents
      const agents = await prisma.user.findMany({
        where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
      });

      await prisma.notification.createMany({
        data: agents.map((agent) => ({
          userId: agent.id,
          type: "system",
          title: "New Chat Request",
          message: "A customer is waiting for support",
          data: { sessionId: session!.id },
        })),
      });
    }

    // At this point session is guaranteed to be non-null
    if (!session) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    // Determine sender type
    const senderType = session.agentId === user.id ? "agent" : "user";

    // Create message
    const chatMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        senderId: user.id,
        senderType,
        message,
        attachments: attachments || [],
      },
    });

    // Mark other party's messages as read
    await prisma.chatMessage.updateMany({
      where: {
        sessionId: session.id,
        senderId: { not: user.id },
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return NextResponse.json({
      session: { id: session.id, status: session.status },
      message: chatMessage,
    }, { status: sessionId ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Send chat message error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}

// PATCH - Update session (agent actions)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { sessionId, action } = body;

    if (!sessionId || !action) {
      return NextResponse.json({ error: "Session ID and action required" }, { status: 400 });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    let updateData: Record<string, unknown> = {};

    switch (action) {
      case "accept":
        if (session.status !== "WAITING") {
          return NextResponse.json({ error: "Session already accepted" }, { status: 400 });
        }
        updateData = { status: "ACTIVE", agentId: authResult.id };

        // Add system message
        await prisma.chatMessage.create({
          data: {
            sessionId,
            senderId: authResult.id,
            senderType: "bot",
            message: "An agent has joined the chat.",
          },
        });
        break;

      case "close":
        if (session.status === "CLOSED") {
          return NextResponse.json({ error: "Session already closed" }, { status: 400 });
        }
        updateData = { status: "CLOSED", endedAt: new Date() };

        // Add system message
        await prisma.chatMessage.create({
          data: {
            sessionId,
            senderId: authResult.id,
            senderType: "bot",
            message: "This chat session has been closed.",
          },
        });

        // Notify user to rate
        await prisma.notification.create({
          data: {
            userId: session.userId,
            type: "system",
            title: "Rate Your Support Experience",
            message: "How was your chat support experience?",
            data: { sessionId, action: "rate_chat" },
          },
        });
        break;

      case "transfer":
        const { toAgentId } = body;
        if (!toAgentId) {
          return NextResponse.json({ error: "Target agent ID required" }, { status: 400 });
        }
        updateData = { agentId: toAgentId };

        await prisma.chatMessage.create({
          data: {
            sessionId,
            senderId: authResult.id,
            senderType: "bot",
            message: "You have been transferred to another agent.",
          },
        });
        break;

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: updateData,
    });

    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error("Update chat session error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

// PUT - Rate chat session
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { sessionId, rating, feedback } = body;

    if (!sessionId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Valid session ID and rating (1-5) required" }, { status: 400 });
    }

    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId: user.id },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.rating) {
      return NextResponse.json({ error: "Session already rated" }, { status: 400 });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { rating, feedback },
    });

    return NextResponse.json({ success: true, session: updated });
  } catch (error) {
    console.error("Rate chat session error:", error);
    return NextResponse.json({ error: "Failed to rate session" }, { status: 500 });
  }
}
