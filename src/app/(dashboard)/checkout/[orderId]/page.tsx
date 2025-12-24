"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Building2,
  Wallet,
  Loader2,
  CheckCircle,
  Lock,
  AlertCircle,
  ArrowLeft,
  Package,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  currency: string;
  items: OrderItem[];
  business: {
    name: string;
  };
}

interface PaymentMethod {
  id: string;
  type: string;
  last4: string;
  brand?: string;
  bankName?: string;
  status: string;
}

interface WalletBalance {
  id: string;
  balance: number;
  currency: string;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function CheckoutPage({ params }: { params: Promise<{ orderId: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [wallets, setWallets] = useState<WalletBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Payment selection
  const [paymentType, setPaymentType] = useState<"wallet" | "card" | "bank">("wallet");
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch order details
        const orderResponse = await fetch(`/api/checkout/${resolvedParams.orderId}`);
        if (!orderResponse.ok) throw new Error("Order not found");
        const orderData = await orderResponse.json();
        setOrder(orderData.order);

        // Fetch payment methods
        const methodsResponse = await fetch("/api/payment-methods");
        if (methodsResponse.ok) {
          const methodsData = await methodsResponse.json();
          setPaymentMethods(methodsData.paymentMethods);
        }

        // Fetch wallet balance
        const walletResponse = await fetch("/api/wallet");
        if (walletResponse.ok) {
          const walletData = await walletResponse.json();
          setWallets(walletData.wallets);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load checkout");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [resolvedParams.orderId]);

  const handlePayment = async () => {
    if (!order) return;

    setProcessing(true);
    setError(null);

    try {
      const paymentData: Record<string, unknown> = {
        orderId: order.id,
        paymentType,
      };

      if (paymentType === "wallet") {
        const usdWallet = wallets.find(w => w.currency === order.currency);
        if (!usdWallet || usdWallet.balance < order.total) {
          throw new Error("Insufficient wallet balance");
        }
        paymentData.walletId = usdWallet.id;
      } else {
        if (!selectedMethod) {
          throw new Error("Please select a payment method");
        }
        paymentData.paymentMethodId = selectedMethod;
      }

      const response = await fetch("/api/checkout/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Payment failed");
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard/transactions");
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-6">
              Your order has been placed successfully.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirecting to transactions...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
            <p className="text-muted-foreground mb-6">
              This order doesn't exist or has already been processed.
            </p>
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cards = paymentMethods.filter(pm => pm.type !== "BANK_ACCOUNT" && pm.status === "VERIFIED");
  const banks = paymentMethods.filter(pm => pm.type === "BANK_ACCOUNT" && pm.status === "VERIFIED");
  const usdWallet = wallets.find(w => w.currency === order.currency);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4">
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Checkout</h1>
        <p className="text-muted-foreground">Complete your purchase</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Payment Methods */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Choose how you want to pay</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={paymentType} onValueChange={(v) => setPaymentType(v as "wallet" | "card" | "bank")}>
                {/* Wallet Option */}
                <div className={`flex items-center space-x-4 p-4 border rounded-lg cursor-pointer ${paymentType === "wallet" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Label htmlFor="wallet" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5" />
                        <div>
                          <p className="font-medium">Pay from Wallet</p>
                          <p className="text-sm text-muted-foreground">
                            Balance: {formatCurrency(usdWallet?.balance || 0, order.currency)}
                          </p>
                        </div>
                      </div>
                      {usdWallet && usdWallet.balance >= order.total && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Sufficient funds
                        </Badge>
                      )}
                    </div>
                  </Label>
                </div>

                {/* Card Option */}
                <div className={`flex items-center space-x-4 p-4 border rounded-lg cursor-pointer ${paymentType === "card" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Credit/Debit Card</p>
                        <p className="text-sm text-muted-foreground">
                          {cards.length > 0 ? `${cards.length} card(s) saved` : "No cards saved"}
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>

                {/* Bank Option */}
                <div className={`flex items-center space-x-4 p-4 border rounded-lg cursor-pointer ${paymentType === "bank" ? "border-primary bg-primary/5" : ""}`}>
                  <RadioGroupItem value="bank" id="bank" />
                  <Label htmlFor="bank" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <Building2 className="h-5 w-5" />
                      <div>
                        <p className="font-medium">Bank Account</p>
                        <p className="text-sm text-muted-foreground">
                          {banks.length > 0 ? `${banks.length} account(s) linked` : "No accounts linked"}
                        </p>
                      </div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>

              {/* Card Selection */}
              {paymentType === "card" && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>Select Card</Label>
                  {cards.length > 0 ? (
                    <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
                      {cards.map((card) => (
                        <div key={card.id} className={`flex items-center space-x-4 p-3 border rounded-lg cursor-pointer ${selectedMethod === card.id ? "border-primary" : ""}`}>
                          <RadioGroupItem value={card.id} id={card.id} />
                          <Label htmlFor={card.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-12 bg-gradient-to-br from-gray-800 to-gray-600 rounded flex items-center justify-center">
                                <CreditCard className="h-4 w-4 text-white" />
                              </div>
                              <div>
                                <p className="font-medium">{card.brand || "Card"} •••• {card.last4}</p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No cards saved. <Link href="/dashboard/payment-methods" className="text-primary underline">Add a card</Link>
                    </p>
                  )}
                </div>
              )}

              {/* Bank Selection */}
              {paymentType === "bank" && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>Select Bank Account</Label>
                  {banks.length > 0 ? (
                    <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod}>
                      {banks.map((bank) => (
                        <div key={bank.id} className={`flex items-center space-x-4 p-3 border rounded-lg cursor-pointer ${selectedMethod === bank.id ? "border-primary" : ""}`}>
                          <RadioGroupItem value={bank.id} id={bank.id} />
                          <Label htmlFor={bank.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-12 bg-blue-100 rounded flex items-center justify-center">
                                <Building2 className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">{bank.bankName || "Bank"} •••• {bank.last4}</p>
                              </div>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No bank accounts linked. <Link href="/dashboard/payment-methods" className="text-primary underline">Add an account</Link>
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
              <CardDescription>Order #{order.orderNumber}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                From: {order.business.name}
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.totalPrice, order.currency)}</p>
                  </div>
                ))}
              </div>

              <Separator />

              {/* Totals */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal, order.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(order.tax, order.currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(order.total, order.currency)}</span>
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePayment}
                disabled={
                  processing ||
                  (paymentType === "wallet" && (!usdWallet || usdWallet.balance < order.total)) ||
                  ((paymentType === "card" || paymentType === "bank") && !selectedMethod)
                }
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Pay {formatCurrency(order.total, order.currency)}
                  </>
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
                <Lock className="h-3 w-3" />
                Secure payment
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
