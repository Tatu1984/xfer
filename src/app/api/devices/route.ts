import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-utils";
import { headers } from "next/headers";

// Generate device fingerprint from headers
function generateDeviceId(userAgent: string, ip: string): string {
  return crypto
    .createHash("sha256")
    .update(`${userAgent}-${ip}`)
    .digest("hex")
    .substring(0, 32);
}

// Parse user agent to get device info
function parseUserAgent(userAgent: string): {
  browser: string;
  os: string;
  deviceType: string;
} {
  const ua = userAgent.toLowerCase();

  // Determine browser
  let browser = "Unknown";
  if (ua.includes("chrome") && !ua.includes("edg")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("edg")) browser = "Edge";

  // Determine OS
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Determine device type
  let deviceType = "Desktop";
  if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone"))
    deviceType = "Mobile";
  else if (ua.includes("tablet") || ua.includes("ipad")) deviceType = "Tablet";

  return { browser, os, deviceType };
}

// GET /api/devices - List user's devices
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const devices = await prisma.device.findMany({
      where: { userId: user.id },
      orderBy: { lastUsedAt: "desc" },
    });

    // Get current device ID
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const currentDeviceId = generateDeviceId(userAgent, ip);

    return NextResponse.json({
      devices: devices.map((d) => ({
        id: d.id,
        deviceName: d.deviceName,
        deviceType: d.deviceType,
        browser: d.browser,
        os: d.os,
        isTrusted: d.isTrusted,
        lastUsedAt: d.lastUsedAt,
        createdAt: d.createdAt,
        isCurrent: d.deviceId === currentDeviceId,
      })),
    });
  } catch (error) {
    console.error("Get devices error:", error);
    return NextResponse.json({ error: "Failed to fetch devices" }, { status: 500 });
  }
}

// POST /api/devices - Register current device
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const headersList = await headers();
    const userAgent = headersList.get("user-agent") || "";
    const ip = headersList.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const deviceId = generateDeviceId(userAgent, ip);
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    const body = await request.json().catch(() => ({}));
    const deviceName = body.deviceName || `${browser} on ${os}`;

    // Upsert device
    const device = await prisma.device.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId,
        },
      },
      update: {
        lastUsedAt: new Date(),
        deviceName,
      },
      create: {
        userId: user.id,
        deviceId,
        deviceName,
        deviceType,
        browser,
        os,
        lastUsedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: device.id,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      isTrusted: device.isTrusted,
      isNew: device.createdAt.getTime() > Date.now() - 1000,
    });
  } catch (error) {
    console.error("Register device error:", error);
    return NextResponse.json({ error: "Failed to register device" }, { status: 500 });
  }
}

// PATCH /api/devices - Update device (trust/untrust, rename)
const updateDeviceSchema = z.object({
  id: z.string(),
  deviceName: z.string().optional(),
  isTrusted: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const { id, deviceName, isTrusted } = updateDeviceSchema.parse(body);

    // Verify ownership
    const device = await prisma.device.findFirst({
      where: { id, userId: user.id },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(deviceName !== undefined ? { deviceName } : {}),
        ...(isTrusted !== undefined ? { isTrusted } : {}),
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: isTrusted !== undefined ? (isTrusted ? "device_trusted" : "device_untrusted") : "device_renamed",
        entityType: "device",
        entityId: id,
        details: { deviceName: updated.deviceName },
      },
    });

    return NextResponse.json({
      id: updated.id,
      deviceName: updated.deviceName,
      isTrusted: updated.isTrusted,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("Update device error:", error);
    return NextResponse.json({ error: "Failed to update device" }, { status: 500 });
  }
}

// DELETE /api/devices - Remove device
export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Device ID is required" }, { status: 400 });
    }

    // Verify ownership
    const device = await prisma.device.findFirst({
      where: { id, userId: user.id },
    });

    if (!device) {
      return NextResponse.json({ error: "Device not found" }, { status: 404 });
    }

    await prisma.device.delete({ where: { id } });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: "device_removed",
        entityType: "device",
        entityId: id,
        details: { deviceName: device.deviceName },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete device error:", error);
    return NextResponse.json({ error: "Failed to remove device" }, { status: 500 });
  }
}
