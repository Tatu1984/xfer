import { NextResponse } from "next/server";
import { getSupportedCurrencies } from "@/lib/fx";
import { prisma } from "@/lib/prisma";

// GET /api/fx/currencies - Get supported currencies and rates
export async function GET() {
  try {
    const supportedCurrencies = getSupportedCurrencies();

    // Get currencies from database
    const currencies = await prisma.currency.findMany({
      where: { isActive: true },
    });

    // Get recent exchange rates
    const rates = await prisma.exchangeRate.findMany({
      where: {
        OR: [
          { validUntil: null },
          { validUntil: { gt: new Date() } },
        ],
      },
      orderBy: { validFrom: "desc" },
      distinct: ["fromCurrency", "toCurrency"],
    });

    return NextResponse.json({
      currencies: currencies.length > 0 ? currencies : supportedCurrencies.map(code => ({
        code,
        name: getCurrencyName(code),
        symbol: getCurrencySymbol(code),
        decimals: 2,
        isActive: true,
      })),
      rates: rates.map(r => ({
        from: r.fromCurrency,
        to: r.toCurrency,
        rate: Number(r.rate),
        updatedAt: r.validFrom.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Get currencies error:", error);
    return NextResponse.json({ error: "Failed to fetch currencies" }, { status: 500 });
  }
}

function getCurrencyName(code: string): string {
  const names: Record<string, string> = {
    USD: "US Dollar",
    EUR: "Euro",
    GBP: "British Pound",
    CAD: "Canadian Dollar",
    AUD: "Australian Dollar",
    JPY: "Japanese Yen",
    CHF: "Swiss Franc",
    INR: "Indian Rupee",
    MXN: "Mexican Peso",
    BRL: "Brazilian Real",
  };
  return names[code] || code;
}

function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    CHF: "Fr",
    INR: "₹",
    MXN: "$",
    BRL: "R$",
  };
  return symbols[code] || code;
}
