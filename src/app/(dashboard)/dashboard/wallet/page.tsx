"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Link from "next/link";

interface WalletData {
  id: string;
  currency: string;
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  isDefault: boolean;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  sender?: { displayName: string } | null;
  receiver?: { displayName: string } | null;
}

interface WalletResponse {
  wallets: WalletData[];
  totals: {
    totalBalance: number;
    availableBalance: number;
    pendingBalance: number;
  };
  defaultCurrency: string;
}

interface TransactionsResponse {
  transactions: Transaction[];
}

const currencyInfo: Record<string, { name: string; flag: string }> = {
  USD: { name: "US Dollar", flag: "🇺🇸" },
  EUR: { name: "Euro", flag: "🇪🇺" },
  GBP: { name: "British Pound", flag: "🇬🇧" },
  CAD: { name: "Canadian Dollar", flag: "🇨🇦" },
  AUD: { name: "Australian Dollar", flag: "🇦🇺" },
  JPY: { name: "Japanese Yen", flag: "🇯🇵" },
  CHF: { name: "Swiss Franc", flag: "🇨🇭" },
  INR: { name: "Indian Rupee", flag: "🇮🇳" },
};

const availableCurrencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "INR"];

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function WalletPage() {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totals, setTotals] = useState({ totalBalance: 0, availableBalance: 0, pendingBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBalances, setShowBalances] = useState(true);
  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [newCurrency, setNewCurrency] = useState("");
  const [addingCurrency, setAddingCurrency] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [walletRes, txRes] = await Promise.all([
        fetch("/api/wallet"),
        fetch("/api/transactions?limit=5"),
      ]);

      if (!walletRes.ok) throw new Error("Failed to fetch wallet data");

      const walletData: WalletResponse = await walletRes.json();
      setWallets(walletData.wallets);
      setTotals(walletData.totals);

      if (txRes.ok) {
        const txData: TransactionsResponse = await txRes.json();
        setTransactions(txData.transactions);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddCurrency = async () => {
    if (!newCurrency) return;
    setAddingCurrency(true);
    try {
      const response = await fetch("/api/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: newCurrency }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add currency");
      }

      setAddCurrencyOpen(false);
      setNewCurrency("");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add currency");
    } finally {
      setAddingCurrency(false);
    }
  };

  const existingCurrencies = wallets.map(w => w.currency);
  const addableCurrencies = availableCurrencies.filter(c => !existingCurrencies.includes(c));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>
          <p className="text-muted-foreground">
            Manage your balances and currencies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowBalances(!showBalances)}
          >
            {showBalances ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/send">
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Send Money
            </Link>
          </Button>
        </div>
      </div>

      {/* Total Balance */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">Total Balance</p>
              <p className="text-4xl font-bold mt-1">
                {showBalances
                  ? formatCurrency(totals.totalBalance, "USD")
                  : "••••••••"}
              </p>
              <div className="flex gap-6 mt-4 text-sm">
                <div>
                  <span className="opacity-70">Available: </span>
                  <span className="font-medium">
                    {showBalances
                      ? formatCurrency(totals.availableBalance, "USD")
                      : "••••"}
                  </span>
                </div>
                <div>
                  <span className="opacity-70">Pending: </span>
                  <span className="font-medium">
                    {showBalances
                      ? formatCurrency(totals.pendingBalance, "USD")
                      : "••••"}
                  </span>
                </div>
              </div>
            </div>
            <Wallet className="h-16 w-16 opacity-20" />
          </div>
          <div className="flex gap-4 mt-6">
            <Button variant="secondary" asChild>
              <Link href="/dashboard/send">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Send
              </Link>
            </Button>
            <Button variant="secondary">
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Request
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Currency Wallets */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Currencies</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {wallets.map((wallet) => {
            const info = currencyInfo[wallet.currency] || { name: wallet.currency, flag: "💰" };
            return (
              <Card key={wallet.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{info.flag}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{wallet.currency}</h3>
                          {wallet.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {info.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {showBalances
                          ? formatCurrency(wallet.balance, wallet.currency)
                          : "••••••"}
                      </p>
                    </div>
                  </div>
                  {(wallet.pendingBalance > 0 || wallet.reservedBalance > 0) && (
                    <div className="mt-4 pt-4 border-t flex gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground">Available</p>
                        <p className="font-medium text-green-600">
                          {showBalances
                            ? formatCurrency(wallet.availableBalance, wallet.currency)
                            : "••••"}
                        </p>
                      </div>
                      {wallet.pendingBalance > 0 && (
                        <div>
                          <p className="text-muted-foreground">Pending</p>
                          <p className="font-medium text-yellow-600">
                            {showBalances
                              ? formatCurrency(wallet.pendingBalance, wallet.currency)
                              : "••••"}
                          </p>
                        </div>
                      )}
                      {wallet.reservedBalance > 0 && (
                        <div>
                          <p className="text-muted-foreground">Reserved</p>
                          <p className="font-medium text-orange-600">
                            {showBalances
                              ? formatCurrency(wallet.reservedBalance, wallet.currency)
                              : "••••"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Add Currency Card */}
          {addableCurrencies.length > 0 && (
            <Dialog open={addCurrencyOpen} onOpenChange={setAddCurrencyOpen}>
              <DialogTrigger asChild>
                <Card className="border-dashed hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardContent className="p-6 flex items-center justify-center h-full min-h-[150px]">
                    <div className="text-center">
                      <Plus className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="mt-2 font-medium">Add Currency</p>
                      <p className="text-sm text-muted-foreground">
                        Open a new currency wallet
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Currency</DialogTitle>
                  <DialogDescription>
                    Open a new wallet in a different currency
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={newCurrency} onValueChange={setNewCurrency}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {addableCurrencies.map((currency) => {
                        const info = currencyInfo[currency] || { name: currency, flag: "💰" };
                        return (
                          <SelectItem key={currency} value={currency}>
                            <span className="flex items-center gap-2">
                              <span>{info.flag}</span>
                              <span>{currency}</span>
                              <span className="text-muted-foreground">- {info.name}</span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddCurrencyOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddCurrency} disabled={!newCurrency || addingCurrency}>
                    {addingCurrency ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Currency"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest wallet transactions</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/transactions">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions.length > 0 ? (
              transactions.map((tx) => {
                const isIncoming = tx.type.includes("IN") || tx.type === "DEPOSIT" || tx.type === "REFUND";
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          isIncoming ? "bg-green-100" : "bg-red-100"
                        }`}
                      >
                        {isIncoming ? (
                          <ArrowDownLeft className="h-5 w-5 text-green-600" />
                        ) : (
                          <ArrowUpRight className="h-5 w-5 text-red-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">
                          {tx.description ||
                            (isIncoming
                              ? tx.sender?.displayName || "Received"
                              : tx.receiver?.displayName || "Sent")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`font-semibold ${
                        isIncoming ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {isIncoming ? "+" : "-"}
                      {formatCurrency(tx.amount, tx.currency)}
                    </p>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No transactions yet</p>
                <p className="text-sm">Send money to get started</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
