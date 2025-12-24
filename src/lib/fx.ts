import { prisma } from "@/lib/prisma";

export interface ConversionQuote {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  spread: number;
  expiresAt: Date;
  quoteId: string;
}

// Default exchange rates (in production, fetch from external API)
const baseRates: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149.50,
  CHF: 0.88,
  INR: 83.12,
  MXN: 17.15,
  BRL: 4.97,
};

// Spread percentage for FX conversion
const DEFAULT_SPREAD = 2.5; // 2.5%

// Get exchange rate between two currencies
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<{ rate: number; spread: number }> {
  // Try to get from database first
  const dbRate = await prisma.exchangeRate.findFirst({
    where: {
      fromCurrency,
      toCurrency,
      OR: [
        { validUntil: null },
        { validUntil: { gt: new Date() } },
      ],
    },
    orderBy: { validFrom: "desc" },
  });

  if (dbRate) {
    return {
      rate: Number(dbRate.rate),
      spread: Number(dbRate.spread),
    };
  }

  // Calculate from base rates
  const fromRate = baseRates[fromCurrency];
  const toRate = baseRates[toCurrency];

  if (!fromRate || !toRate) {
    throw new Error(`Unsupported currency pair: ${fromCurrency}/${toCurrency}`);
  }

  // Convert through USD as base
  const rate = toRate / fromRate;

  return { rate, spread: DEFAULT_SPREAD };
}

// Apply spread to get final rate
function applySpread(rate: number, spread: number): number {
  // Spread is applied by giving a less favorable rate
  return rate * (1 - spread / 100);
}

// Get conversion quote
export async function getConversionQuote(
  fromCurrency: string,
  toCurrency: string,
  fromAmount: number
): Promise<ConversionQuote> {
  if (fromCurrency === toCurrency) {
    throw new Error("Cannot convert to same currency");
  }

  const { rate, spread } = await getExchangeRate(fromCurrency, toCurrency);
  const effectiveRate = applySpread(rate, spread);

  // Calculate fee (0.5% of amount, minimum 0.50)
  const feePercentage = 0.5;
  const fee = Math.max(fromAmount * (feePercentage / 100), 0.50);

  // Calculate final amount
  const amountAfterFee = fromAmount - fee;
  const toAmount = amountAfterFee * effectiveRate;

  // Generate quote ID
  const quoteId = `fxq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  // Quote expires in 30 seconds
  const expiresAt = new Date(Date.now() + 30 * 1000);

  return {
    fromCurrency,
    toCurrency,
    fromAmount,
    toAmount: Math.round(toAmount * 100) / 100,
    rate: effectiveRate,
    fee,
    spread,
    expiresAt,
    quoteId,
  };
}

// Execute currency conversion
export async function executeConversion(
  userId: string,
  fromCurrency: string,
  toCurrency: string,
  fromAmount: number
): Promise<{
  success: boolean;
  fromWalletId: string;
  toWalletId: string;
  convertedAmount: number;
  rate: number;
  fee: number;
}> {
  // Get quote
  const quote = await getConversionQuote(fromCurrency, toCurrency, fromAmount);

  // Get or create wallets
  const [fromWallet, toWalletExists] = await Promise.all([
    prisma.wallet.findFirst({
      where: { userId, currency: fromCurrency, isActive: true },
    }),
    prisma.wallet.findFirst({
      where: { userId, currency: toCurrency, isActive: true },
    }),
  ]);

  if (!fromWallet) {
    throw new Error(`No ${fromCurrency} wallet found`);
  }

  if (Number(fromWallet.availableBalance) < fromAmount) {
    throw new Error("Insufficient balance");
  }

  // Create destination wallet if doesn't exist
  let toWallet = toWalletExists;
  if (!toWallet) {
    toWallet = await prisma.wallet.create({
      data: {
        userId,
        currency: toCurrency,
        balance: 0,
        availableBalance: 0,
        pendingBalance: 0,
        isDefault: false,
      },
    });
  }

  // Execute conversion in transaction
  await prisma.$transaction(async (tx) => {
    // Debit from source wallet
    await tx.wallet.update({
      where: { id: fromWallet.id },
      data: {
        balance: { decrement: fromAmount },
        availableBalance: { decrement: fromAmount },
      },
    });

    // Credit to destination wallet
    await tx.wallet.update({
      where: { id: toWallet!.id },
      data: {
        balance: { increment: quote.toAmount },
        availableBalance: { increment: quote.toAmount },
      },
    });

    // Create ledger entries
    await tx.ledgerEntry.createMany({
      data: [
        {
          walletId: fromWallet.id,
          entryType: "debit",
          amount: fromAmount,
          balanceBefore: fromWallet.balance,
          balanceAfter: Number(fromWallet.balance) - fromAmount,
          description: `FX conversion to ${toCurrency}`,
          reference: quote.quoteId,
        },
        {
          walletId: toWallet!.id,
          entryType: "credit",
          amount: quote.toAmount,
          balanceBefore: toWallet!.balance,
          balanceAfter: Number(toWallet!.balance) + quote.toAmount,
          description: `FX conversion from ${fromCurrency}`,
          reference: quote.quoteId,
        },
      ],
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        userId,
        action: "fx_conversion",
        entityType: "wallet",
        entityId: fromWallet.id,
        details: {
          fromCurrency,
          toCurrency,
          fromAmount,
          toAmount: quote.toAmount,
          rate: quote.rate,
          fee: quote.fee,
          quoteId: quote.quoteId,
        },
      },
    });
  });

  return {
    success: true,
    fromWalletId: fromWallet.id,
    toWalletId: toWallet.id,
    convertedAmount: quote.toAmount,
    rate: quote.rate,
    fee: quote.fee,
  };
}

// Get supported currencies
export function getSupportedCurrencies(): string[] {
  return Object.keys(baseRates);
}

// Update exchange rates (for cron job / admin)
export async function updateExchangeRates(
  rates: Array<{ from: string; to: string; rate: number; spread?: number }>
): Promise<void> {
  const now = new Date();

  await prisma.$transaction(
    rates.map((r) =>
      prisma.exchangeRate.create({
        data: {
          fromCurrency: r.from,
          toCurrency: r.to,
          rate: r.rate,
          spread: r.spread || DEFAULT_SPREAD,
          validFrom: now,
        },
      })
    )
  );
}
