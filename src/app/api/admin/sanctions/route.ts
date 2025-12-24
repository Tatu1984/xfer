import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-utils";

const screeningSchema = z.object({
  userId: z.string(),
  screeningType: z.enum(["onboarding", "transaction", "periodic"]),
});

// Simple name matching algorithm (in production, use a dedicated service)
function calculateMatchScore(name1: string, name2: string): number {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();

  if (n1 === n2) return 1.0;

  // Check if one contains the other
  if (n1.includes(n2) || n2.includes(n1)) return 0.8;

  // Simple Levenshtein-based similarity
  const len1 = n1.length;
  const len2 = n2.length;
  const maxLen = Math.max(len1, len2);

  if (maxLen === 0) return 1.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = n1[i - 1] === n2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  return 1 - distance / maxLen;
}

// GET - List sanctions screenings
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [screenings, total] = await Promise.all([
      prisma.sanctionsScreening.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.sanctionsScreening.count({ where }),
    ]);

    // Get stats
    const stats = await prisma.sanctionsScreening.groupBy({
      by: ["status"],
      _count: true,
    });

    return NextResponse.json({
      screenings,
      stats: Object.fromEntries(stats.map((s) => [s.status, s._count])),
      pagination: { total, limit, offset, hasMore: offset + screenings.length < total },
    });
  } catch (error) {
    console.error("Get sanctions screenings error:", error);
    return NextResponse.json({ error: "Failed to fetch screenings" }, { status: 500 });
  }
}

// POST - Run sanctions screening
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { userId, screeningType } = screeningSchema.parse(body);

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        country: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();

    if (!fullName) {
      return NextResponse.json({ error: "User has no name to screen" }, { status: 400 });
    }

    // Search sanctions lists
    const potentialMatches = await prisma.sanctionsList.findMany({
      where: {
        OR: [
          { name: { contains: fullName, mode: "insensitive" } },
          { aliases: { hasSome: [fullName.toLowerCase()] } },
        ],
      },
    });

    // Calculate match scores
    const matches = potentialMatches
      .map((entry) => {
        const nameScore = calculateMatchScore(fullName, entry.name);
        const aliasScores = entry.aliases.map((a) => calculateMatchScore(fullName, a));
        const maxScore = Math.max(nameScore, ...aliasScores);

        return {
          entry,
          score: maxScore,
        };
      })
      .filter((m) => m.score >= 0.7)
      .sort((a, b) => b.score - a.score);

    const matchFound = matches.length > 0;
    const status = matchFound
      ? matches[0].score >= 0.95
        ? "CONFIRMED_MATCH"
        : "POTENTIAL_MATCH"
      : "CLEAR";

    // Create screening record
    const screening = await prisma.sanctionsScreening.create({
      data: {
        userId,
        screeningType,
        matchFound,
        matchDetails: matchFound
          ? matches.map((m) => ({
              listType: m.entry.listType,
              entityType: m.entry.entityType,
              name: m.entry.name,
              score: m.score,
              countries: m.entry.countries,
            }))
          : undefined,
        status,
      },
    });

    // Create compliance alert if match found
    if (matchFound) {
      await prisma.complianceAlert.create({
        data: {
          userId,
          alertType: "SANCTIONS_MATCH",
          severity: status === "CONFIRMED_MATCH" ? "CRITICAL" : "HIGH",
          title: "Sanctions Screening Match",
          description: `${status === "CONFIRMED_MATCH" ? "Confirmed" : "Potential"} sanctions match found for ${fullName}`,
          details: {
            screeningId: screening.id,
            matches: matches.slice(0, 5).map((m) => ({
              name: m.entry.name,
              listType: m.entry.listType,
              score: m.score,
            })),
          },
        },
      });

      // If confirmed match, restrict user
      if (status === "CONFIRMED_MATCH") {
        await prisma.user.update({
          where: { id: userId },
          data: { status: "SUSPENDED" },
        });

        await prisma.riskProfile.upsert({
          where: { userId },
          create: {
            userId,
            riskLevel: "CRITICAL",
            isRestricted: true,
            restrictionReason: "Sanctions match - pending review",
          },
          update: {
            riskLevel: "CRITICAL",
            isRestricted: true,
            restrictionReason: "Sanctions match - pending review",
          },
        });
      }
    }

    // Update KYC screening flags
    await prisma.kYCVerification.updateMany({
      where: { userId },
      data: {
        sanctionsChecked: true,
        lastScreeningDate: new Date(),
      },
    });

    return NextResponse.json({
      screening,
      result: {
        matchFound,
        status,
        matchCount: matches.length,
        topMatches: matches.slice(0, 3).map((m) => ({
          name: m.entry.name,
          listType: m.entry.listType,
          score: Math.round(m.score * 100) + "%",
        })),
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: error.issues }, { status: 400 });
    }
    console.error("Run sanctions screening error:", error);
    return NextResponse.json({ error: "Failed to run screening" }, { status: 500 });
  }
}

// PATCH - Review screening result
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, status, notes } = body;

    if (!id || !status) {
      return NextResponse.json({ error: "ID and status required" }, { status: 400 });
    }

    if (!["CLEAR", "FALSE_POSITIVE", "CONFIRMED_MATCH"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const screening = await prisma.sanctionsScreening.findUnique({
      where: { id },
    });

    if (!screening) {
      return NextResponse.json({ error: "Screening not found" }, { status: 404 });
    }

    const updated = await prisma.sanctionsScreening.update({
      where: { id },
      data: {
        status,
        notes,
        reviewedBy: authResult.id,
        reviewedAt: new Date(),
      },
    });

    // If marked as false positive, unrestrict user
    if (status === "FALSE_POSITIVE" || status === "CLEAR") {
      await prisma.riskProfile.updateMany({
        where: { userId: screening.userId, restrictionReason: { contains: "Sanctions" } },
        data: { isRestricted: false, restrictionReason: null },
      });

      // Resolve related compliance alert
      await prisma.complianceAlert.updateMany({
        where: {
          userId: screening.userId,
          alertType: "SANCTIONS_MATCH",
          status: "NEW",
        },
        data: {
          status: "FALSE_POSITIVE",
          resolvedBy: authResult.id,
          resolvedAt: new Date(),
          resolution: notes || `Marked as ${status.toLowerCase().replace("_", " ")}`,
        },
      });
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: authResult.id,
        action: "sanctions_review",
        entityType: "sanctions_screening",
        entityId: id,
        details: { status, notes },
      },
    });

    return NextResponse.json({ screening: updated });
  } catch (error) {
    console.error("Review sanctions screening error:", error);
    return NextResponse.json({ error: "Failed to review screening" }, { status: 500 });
  }
}
