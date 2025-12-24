import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";

// Generate API key
function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `xfer_live_${crypto.randomBytes(32).toString("hex")}`;
  const prefix = key.substring(0, 16);
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  return { key, prefix, hash };
}

// GET /api/api-keys - List user's API keys
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const apiKeys = await prisma.aPIKey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        lastUsedAt: true,
        expiresAt: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ apiKeys });
  } catch (error) {
    console.error("Get API keys error:", error);
    return NextResponse.json({ error: "Failed to fetch API keys" }, { status: 500 });
  }
}

// POST /api/api-keys - Create new API key
const createKeySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  permissions: z.array(z.string()).default(["read"]),
  expiresInDays: z.number().min(1).max(365).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { name, permissions, expiresInDays } = createKeySchema.parse(body);

    // Limit number of API keys per user
    const existingCount = await prisma.aPIKey.count({
      where: { userId: user.id },
    });

    if (existingCount >= 10) {
      return NextResponse.json(
        { error: "Maximum of 10 API keys allowed" },
        { status: 400 }
      );
    }

    const { key, prefix, hash } = generateApiKey();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await prisma.aPIKey.create({
      data: {
        userId: user.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        permissions,
        expiresAt,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "api_key_created",
        entityType: "api_key",
        entityId: apiKey.id,
        details: { name },
      },
    });

    return NextResponse.json({
      id: apiKey.id,
      key, // Only returned once
      name: apiKey.name,
      prefix: apiKey.keyPrefix,
      permissions: apiKey.permissions,
      expiresAt: apiKey.expiresAt,
      message: "Save this key now. You won't be able to see it again.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Create API key error:", error);
    return NextResponse.json({ error: "Failed to create API key" }, { status: 500 });
  }
}

// DELETE /api/api-keys - Revoke API key
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");

    if (!keyId) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    // Verify ownership
    const apiKey = await prisma.aPIKey.findFirst({
      where: { id: keyId, userId: user.id },
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await prisma.aPIKey.delete({ where: { id: keyId } });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "api_key_revoked",
        entityType: "api_key",
        entityId: keyId,
        details: { name: apiKey.name },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete API key error:", error);
    return NextResponse.json({ error: "Failed to revoke API key" }, { status: 500 });
  }
}

// Verify API key (for use in middleware)
export async function verifyApiKey(key: string): Promise<{
  valid: boolean;
  userId?: string;
  permissions?: string[];
}> {
  if (!key || !key.startsWith("xfer_live_")) {
    return { valid: false };
  }

  const hash = crypto.createHash("sha256").update(key).digest("hex");

  const apiKey = await prisma.aPIKey.findFirst({
    where: {
      keyHash: hash,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: { user: true },
  });

  if (!apiKey) {
    return { valid: false };
  }

  // Update last used
  await prisma.aPIKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    userId: apiKey.userId,
    permissions: apiKey.permissions,
  };
}
