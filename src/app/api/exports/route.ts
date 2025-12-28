import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/lib/auth-utils";
import {
  exportTransactions,
  exportDisputes,
  exportInvoices,
  exportPayouts,
  exportCustomers,
  exportOrders,
  exportTaxReport,
  exportUsers,
  exportSettlements,
  exportComplianceAlerts,
  ExportOptions,
} from "@/lib/export";

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { id: userId, role } = authResult;

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type");
    const format = (searchParams.get("format") as "csv" | "json") || "csv";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const year = searchParams.get("year");

    if (!type) {
      return NextResponse.json(
        { error: "Export type is required" },
        { status: 400 }
      );
    }

    const options: ExportOptions = {
      format,
      dateRange:
        startDate && endDate
          ? {
              start: new Date(startDate),
              end: new Date(endDate),
            }
          : undefined,
    };

    let result;

    switch (type) {
      case "transactions":
        result = await exportTransactions(userId, options);
        break;

      case "disputes":
        result = await exportDisputes(userId, options);
        break;

      case "invoices":
        if (role !== "VENDOR" && role !== "ADMIN") {
          return NextResponse.json(
            { error: "Only vendors can export invoices" },
            { status: 403 }
          );
        }
        result = await exportInvoices(userId, options);
        break;

      case "payouts":
        if (role !== "VENDOR" && role !== "ADMIN") {
          return NextResponse.json(
            { error: "Only vendors can export payouts" },
            { status: 403 }
          );
        }
        result = await exportPayouts(userId, options);
        break;

      case "customers":
        if (role !== "VENDOR" && role !== "ADMIN") {
          return NextResponse.json(
            { error: "Only vendors can export customers" },
            { status: 403 }
          );
        }
        result = await exportCustomers(userId, options);
        break;

      case "orders":
        if (role !== "VENDOR" && role !== "ADMIN") {
          return NextResponse.json(
            { error: "Only vendors can export orders" },
            { status: 403 }
          );
        }
        result = await exportOrders(userId, options);
        break;

      case "tax-report":
        if (!year) {
          return NextResponse.json(
            { error: "Year is required for tax reports" },
            { status: 400 }
          );
        }
        result = await exportTaxReport(userId, parseInt(year));
        break;

      case "users":
        // Admin only
        const adminCheck = await requireRole(["SUPER_ADMIN", "ADMIN"]);
        if ("error" in adminCheck) {
          return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        result = await exportUsers(options);
        break;

      case "settlements":
        const settlementCheck = await requireRole(["SUPER_ADMIN", "ADMIN"]);
        if ("error" in settlementCheck) {
          return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        result = await exportSettlements(options);
        break;

      case "compliance":
        const complianceCheck = await requireRole(["SUPER_ADMIN", "ADMIN"]);
        if ("error" in complianceCheck) {
          return NextResponse.json({ error: "Admin access required" }, { status: 403 });
        }
        result = await exportComplianceAlerts(options);
        break;

      default:
        return NextResponse.json(
          { error: "Invalid export type" },
          { status: 400 }
        );
    }

    // Return as downloadable file
    return new NextResponse(result.data, {
      headers: {
        "Content-Type": result.mimeType,
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "X-Row-Count": result.rowCount.toString(),
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Export failed" },
      { status: 500 }
    );
  }
}
