"use client";

import { useState, useEffect } from "react";
import {
  ArrowRightLeft,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface Wallet {
  id: string;
  currency: string;
  balance: number;
  availableBalance: number;
}

interface Quote {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  fee: number;
  spread: number;
  expiresAt: string;
  quoteId: string;
}

const currencies = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
];

export default function ConvertPage() {
  const { toast } = useToast();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("EUR");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [converting, setConverting] = useState(false);
  const [quoteExpiry, setQuoteExpiry] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, []);

  useEffect(() => {
    if (quote) {
      const interval = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.floor((new Date(quote.expiresAt).getTime() - Date.now()) / 1000)
        );
        setQuoteExpiry(remaining);
        if (remaining === 0) {
          setQuote(null);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [quote]);

  const fetchWallets = async () => {
    try {
      const response = await fetch("/api/wallet");
      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets);
      }
    } catch (err) {
      console.error("Failed to fetch wallets:", err);
    } finally {
      setLoading(false);
    }
  };

  const getQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    if (fromCurrency === toCurrency) {
      toast({
        title: "Invalid Conversion",
        description: "Please select different currencies",
        variant: "destructive",
      });
      return;
    }

    setQuoteLoading(true);
    try {
      const response = await fetch(
        `/api/fx/quote?from=${fromCurrency}&to=${toCurrency}&amount=${amount}`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get quote");
      }

      setQuote(data.quote);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to get quote",
        variant: "destructive",
      });
    } finally {
      setQuoteLoading(false);
    }
  };

  const executeConversion = async () => {
    if (!quote) return;

    setConverting(true);
    try {
      const response = await fetch("/api/fx/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          amount: parseFloat(amount),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Conversion failed");
      }

      setSuccess(true);
      fetchWallets();
      toast({
        title: "Conversion Successful",
        description: `Converted ${fromCurrency} ${amount} to ${toCurrency} ${data.convertedAmount.toFixed(2)}`,
      });
    } catch (err) {
      toast({
        title: "Conversion Failed",
        description: err instanceof Error ? err.message : "Failed to convert",
        variant: "destructive",
      });
    } finally {
      setConverting(false);
    }
  };

  const swapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
    setQuote(null);
  };

  const resetForm = () => {
    setSuccess(false);
    setAmount("");
    setQuote(null);
  };

  const fromWallet = wallets.find((w) => w.currency === fromCurrency);
  const toWallet = wallets.find((w) => w.currency === toCurrency);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Conversion Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Successfully converted {fromCurrency} {amount} to {toCurrency}
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={resetForm}>
                Convert More
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <a href="/dashboard/wallet">View Wallet</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Convert Currency</h1>
        <p className="text-muted-foreground">
          Exchange between currencies in your wallet
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currency Conversion</CardTitle>
          <CardDescription>Get real-time exchange rates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* From Currency */}
          <div className="space-y-2">
            <Label>From</Label>
            <div className="flex gap-4">
              <Select value={fromCurrency} onValueChange={(v) => { setFromCurrency(v); setQuote(null); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
                className="flex-1"
              />
            </div>
            {fromWallet && (
              <p className="text-sm text-muted-foreground">
                Available: {fromCurrency} {fromWallet.availableBalance.toFixed(2)}
              </p>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="icon"
              onClick={swapCurrencies}
              className="rounded-full"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </div>

          {/* To Currency */}
          <div className="space-y-2">
            <Label>To</Label>
            <div className="flex gap-4">
              <Select value={toCurrency} onValueChange={(v) => { setToCurrency(v); setQuote(null); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex-1 h-10 px-3 border rounded-md bg-muted flex items-center">
                {quote ? (
                  <span className="font-medium">
                    {toCurrency} {quote.toAmount.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </div>
            </div>
            {toWallet && (
              <p className="text-sm text-muted-foreground">
                Current balance: {toCurrency} {toWallet.availableBalance.toFixed(2)}
              </p>
            )}
          </div>

          {/* Quote Details */}
          {quote && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span>Exchange Rate</span>
                <span>1 {fromCurrency} = {quote.rate.toFixed(4)} {toCurrency}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Fee</span>
                <span>{fromCurrency} {quote.fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Spread</span>
                <span>{quote.spread.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t">
                <span>You'll Receive</span>
                <span>{toCurrency} {quote.toAmount.toFixed(2)}</span>
              </div>
              {quoteExpiry !== null && quoteExpiry > 0 && (
                <div className="flex items-center justify-center gap-2 text-sm text-yellow-600 pt-2">
                  <Clock className="h-4 w-4" />
                  Quote expires in {quoteExpiry}s
                </div>
              )}
            </div>
          )}

          {/* Insufficient Balance Warning */}
          {fromWallet && parseFloat(amount || "0") > fromWallet.availableBalance && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Insufficient balance. You have {fromCurrency} {fromWallet.availableBalance.toFixed(2)} available.
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            {!quote ? (
              <Button
                className="flex-1"
                onClick={getQuote}
                disabled={quoteLoading || !amount || parseFloat(amount) <= 0 || fromCurrency === toCurrency}
              >
                {quoteLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Get Quote
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setQuote(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={executeConversion}
                  disabled={converting || quoteExpiry === 0 || (fromWallet && parseFloat(amount) > fromWallet.availableBalance)}
                >
                  {converting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Convert Now
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
