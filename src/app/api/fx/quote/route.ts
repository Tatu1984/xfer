import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-utils";
import { getConversionQuote, getSupportedCurrencies } from "@/lib/fx";

const quoteSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  amount: z.number().positive(),
});

// GET /api/fx/quote - Get FX conversion quote
export async function GET(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromCurrency = searchParams.get("from") || "";
    const toCurrency = searchParams.get("to") || "";
    const amount = parseFloat(searchParams.get("amount") || "0");

    const data = quoteSchema.parse({ fromCurrency, toCurrency, amount });
    const quote = await getConversionQuote(data.fromCurrency, data.toCurrency, data.amount);

    return NextResponse.json({
      quote: {
        ...quote,
        expiresAt: quote.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("FX quote error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get quote" },
      { status: 500 }
    );
  }
}

// POST /api/fx/quote - Execute FX conversion
export async function POST(request: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult || typeof authResult !== "object" || !("user" in authResult)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = authResult.user as { id: string };

  try {
    const body = await request.json();
    const data = quoteSchema.parse(body);

    const { executeConversion } = await import("@/lib/fx");
    const result = await executeConversion(
      user.id,
      data.fromCurrency,
      data.toCurrency,
      data.amount
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("FX conversion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Conversion failed" },
      { status: 500 }
    );
  }
}
