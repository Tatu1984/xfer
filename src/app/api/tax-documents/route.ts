import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import { generateTaxDocument, getTaxSummary } from "@/lib/tax-calculation";

// GET - Get tax documents and summary for a user
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());
    const view = searchParams.get("view") || "documents";

    if (view === "summary") {
      const summary = await getTaxSummary(user.id, year);
      return NextResponse.json({ summary });
    }

    // Get tax documents
    const documents = await prisma.taxDocument.findMany({
      where: { userId: user.id, taxYear: year },
      orderBy: { createdAt: "desc" },
    });

    // Get available years
    const years = await prisma.taxDocument.groupBy({
      by: ["taxYear"],
      where: { userId: user.id },
      orderBy: { taxYear: "desc" },
    });

    return NextResponse.json({
      documents: documents.map((doc) => ({
        id: doc.id,
        type: doc.documentType,
        year: doc.taxYear,
        status: doc.status,
        recipientName: doc.recipientName,
        grossAmount: Number(doc.grossAmount),
        transactionCount: doc.transactionCount,
        generatedAt: doc.generatedAt,
        downloadUrl: doc.fileUrl,
      })),
      availableYears: years.map((y) => y.taxYear),
    });
  } catch (error) {
    console.error("Get tax documents error:", error);
    return NextResponse.json({ error: "Failed to fetch tax documents" }, { status: 500 });
  }
}

// POST - Generate tax document
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = authResult.user as { id: string };

    const body = await request.json();
    const { year, type } = body;

    if (!year || !type) {
      return NextResponse.json({ error: "Year and document type required" }, { status: 400 });
    }

    const validTypes = ["1099K", "1099MISC", "1042S", "SUMMARY"];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
    }

    // Check if already generated
    const existing = await prisma.taxDocument.findUnique({
      where: {
        userId_taxYear_documentType: {
          userId: user.id,
          taxYear: year,
          documentType: type,
        },
      },
    });

    if (existing && existing.status === "GENERATED") {
      return NextResponse.json({
        document: {
          id: existing.id,
          type: existing.documentType,
          status: existing.status,
          downloadUrl: existing.fileUrl,
        },
        message: "Document already exists",
      });
    }

    const documentId = await generateTaxDocument(user.id, year, type);

    const document = await prisma.taxDocument.findUnique({
      where: { id: documentId },
    });

    return NextResponse.json(
      {
        document: {
          id: document?.id,
          type: document?.documentType,
          status: document?.status,
          grossAmount: Number(document?.grossAmount || 0),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Generate tax document error:", error);
    return NextResponse.json({ error: "Failed to generate tax document" }, { status: 500 });
  }
}

// Admin endpoints for bulk generation
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { year, type, userIds } = body;

    if (!year || !type) {
      return NextResponse.json({ error: "Year and document type required" }, { status: 400 });
    }

    // Get eligible users if not specified
    let eligibleUserIds = userIds;

    if (!eligibleUserIds) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31, 23, 59, 59);

      // Find users with sufficient transaction volume
      const eligibleUsers = await prisma.transaction.groupBy({
        by: ["receiverId"],
        where: {
          type: "PAYMENT",
          status: "COMPLETED",
          createdAt: { gte: startOfYear, lte: endOfYear },
        },
        _sum: { amount: true },
        _count: true,
        having: {
          amount: { _sum: { gte: 600 } }, // 1099-K threshold
        },
      });

      eligibleUserIds = eligibleUsers
        .filter((u) => u.receiverId)
        .map((u) => u.receiverId as string);
    }

    const results = {
      generated: 0,
      skipped: 0,
      errors: 0,
    };

    for (const userId of eligibleUserIds) {
      try {
        await generateTaxDocument(userId, year, type);
        results.generated++;
      } catch (error) {
        console.error(`Failed to generate for user ${userId}:`, error);
        results.errors++;
      }
    }

    return NextResponse.json({
      message: "Bulk generation complete",
      results,
    });
  } catch (error) {
    console.error("Bulk tax document generation error:", error);
    return NextResponse.json({ error: "Failed to generate documents" }, { status: 500 });
  }
}

// PATCH - Update document status (admin)
export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireRole(["ADMIN", "SUPER_ADMIN"]);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { id, status, fileUrl, irsFiled, irsFiledAt } = body;

    if (!id) {
      return NextResponse.json({ error: "Document ID required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};

    if (status) {
      const validStatuses = ["PENDING", "GENERATED", "SENT", "CORRECTED"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updateData.status = status;
      if (status === "GENERATED") {
        updateData.generatedAt = new Date();
      }
    }

    if (fileUrl) {
      updateData.fileUrl = fileUrl;
    }

    if (irsFiled !== undefined) {
      updateData.irsFiled = irsFiled;
      if (irsFiled) {
        updateData.irsFiledAt = irsFiledAt || new Date();
      }
    }

    const document = await prisma.taxDocument.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Update tax document error:", error);
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 });
  }
}
