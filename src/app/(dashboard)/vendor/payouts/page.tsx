"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Building2,
  AlertCircle,
  RefreshCw,
  Download,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Payout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  destination: string | null;
  processedAt: string | null;
  createdAt: string;
  notes: string | null;
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  bankName?: string;
  status: string;
}

interface PayoutsResponse {
  payouts: Payout[];
  balance: {
    available: number;
    pending: number;
    currency: string;
  };
  paymentMethods: PaymentMethod[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-blue-800", icon: Loader2 },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800", icon: XCircle },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VendorPayoutsPage() {
  const [data, setData] = useState<PayoutsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/vendor/payouts");
      if (!response.ok) throw new Error("Failed to fetch payouts");
      const result: PayoutsResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRequestPayout = async () => {
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    if (!data || amount > data.balance.available) {
      alert("Amount exceeds available balance");
      return;
    }

    if (!payoutMethod) {
      alert("Please select a payment method");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/vendor/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethodId: payoutMethod,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to request payout");
      }

      setRequestDialogOpen(false);
      setPayoutAmount("");
      setPayoutMethod("");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to request payout");
    } finally {
      setSubmitting(false);
    }
  };

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

  const balance = data?.balance || { available: 0, pending: 0, currency: "USD" };
  const payouts = data?.payouts || [];
  const paymentMethods = data?.paymentMethods || [];
  const pendingPayouts = payouts.filter(p => p.status === "PENDING" || p.status === "PROCESSING");
  const completedPayouts = payouts.filter(p => p.status === "COMPLETED");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payouts</h1>
          <p className="text-muted-foreground">
            Request and manage your earnings payouts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={balance.available <= 0}>
                <Plus className="mr-2 h-4 w-4" />
                Request Payout
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Payout</DialogTitle>
                <DialogDescription>
                  Withdraw funds from your available balance
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Available Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(balance.available, balance.currency)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-7"
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(e.target.value)}
                      max={balance.available}
                      step="0.01"
                    />
                  </div>
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm"
                    onClick={() => setPayoutAmount(balance.available.toString())}
                  >
                    Withdraw all
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Payout Method</Label>
                  <Select value={payoutMethod} onValueChange={setPayoutMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select payout method" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentMethods.filter(pm => pm.type === "BANK_ACCOUNT" && pm.status === "VERIFIED").map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            {pm.bankName || "Bank Account"} •••• {pm.last4}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {paymentMethods.filter(pm => pm.type === "BANK_ACCOUNT" && pm.status === "VERIFIED").length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No verified bank accounts. Add a bank account in Payment Methods.
                    </p>
                  )}
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Payouts typically take 1-3 business days to process.
                  </AlertDescription>
                </Alert>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setRequestDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestPayout}
                  disabled={submitting || !payoutAmount || !payoutMethod}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className="mr-2 h-4 w-4" />
                      Request Payout
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <p className="text-2xl font-bold">{formatCurrency(balance.available, balance.currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{formatCurrency(balance.pending, balance.currency)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <ArrowUpRight className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Paid Out</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    completedPayouts.reduce((sum, p) => sum + p.amount, 0),
                    balance.currency
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Payouts */}
      {pendingPayouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Payouts</CardTitle>
            <CardDescription>Payouts that are being processed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingPayouts.map((payout) => {
                const status = statusConfig[payout.status] || statusConfig.PENDING;
                const StatusIcon = status.icon;
                return (
                  <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                        <ArrowUpRight className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium">Payout Request</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(payout.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(payout.amount, payout.currency)}</p>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payout History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payout History</CardTitle>
            <CardDescription>All your payout transactions</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          {payouts.length > 0 ? (
            <div className="space-y-4">
              {payouts.map((payout) => {
                const status = statusConfig[payout.status] || statusConfig.PENDING;
                const StatusIcon = status.icon;
                return (
                  <div key={payout.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        payout.status === "COMPLETED" ? "bg-green-100" :
                        payout.status === "FAILED" || payout.status === "CANCELLED" ? "bg-red-100" :
                        "bg-muted"
                      }`}>
                        <ArrowUpRight className={`h-5 w-5 ${
                          payout.status === "COMPLETED" ? "text-green-600" :
                          payout.status === "FAILED" || payout.status === "CANCELLED" ? "text-red-600" :
                          "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {payout.method === "BANK_TRANSFER" ? "Bank Transfer" : payout.method}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payout.processedAt ? formatDate(payout.processedAt) : formatDate(payout.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-lg font-bold">{formatCurrency(payout.amount, payout.currency)}</p>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payout history yet</p>
              <p className="text-sm">Your payouts will appear here once you request them</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
