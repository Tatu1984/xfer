"use client";

import { useState, useEffect } from "react";
import {
  CreditCard,
  Building2,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentMethod {
  id: string;
  type: "BANK_ACCOUNT" | "DEBIT_CARD" | "CREDIT_CARD";
  status: "PENDING" | "VERIFIED" | "FAILED" | "EXPIRED";
  isDefault: boolean;
  last4: string;
  expiryMonth?: number;
  expiryYear?: number;
  brand?: string;
  bankName?: string;
  accountType?: string;
  createdAt: string;
}

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
}

const cardBrandIcons: Record<string, string> = {
  visa: "💳",
  mastercard: "💳",
  amex: "💳",
  discover: "💳",
};

const statusConfig: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: "Verified", color: "bg-green-100 text-green-800" },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800" },
  EXPIRED: { label: "Expired", color: "bg-gray-100 text-gray-800" },
};

export default function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addType, setAddType] = useState<"card" | "bank">("card");
  const [submitting, setSubmitting] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Form states
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [bankRouting, setBankRouting] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountType, setBankAccountType] = useState("checking");

  const fetchPaymentMethods = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/payment-methods");
      if (!response.ok) throw new Error("Failed to fetch payment methods");
      const data: PaymentMethodsResponse = await response.json();
      setPaymentMethods(data.paymentMethods);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const handleAddCard = async () => {
    setSubmitting(true);
    try {
      const [month, year] = cardExpiry.split("/").map(s => s.trim());
      const response = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "card",
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryMonth: parseInt(month),
          expiryYear: 2000 + parseInt(year),
          cvv: cardCvc,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add card");
      }

      setAddDialogOpen(false);
      setCardNumber("");
      setCardExpiry("");
      setCardCvc("");
      fetchPaymentMethods();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add card");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBank = async () => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bank_account",
          routingNumber: bankRouting,
          accountNumber: bankAccount,
          accountType: bankAccountType,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add bank account");
      }

      setAddDialogOpen(false);
      setBankRouting("");
      setBankAccount("");
      fetchPaymentMethods();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add bank account");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this payment method?")) return;
    setDeleteLoading(id);
    try {
      const response = await fetch(`/api/payment-methods?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove");
      }

      fetchPaymentMethods();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setDeleteLoading(null);
    }
  };

  const cards = paymentMethods.filter(pm => pm.type !== "BANK_ACCOUNT");
  const banks = paymentMethods.filter(pm => pm.type === "BANK_ACCOUNT");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payment Methods</h1>
          <p className="text-muted-foreground">
            Manage your cards and bank accounts
          </p>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Payment Method
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Add a card or bank account to your wallet
              </DialogDescription>
            </DialogHeader>
            <Tabs value={addType} onValueChange={(v) => setAddType(v as "card" | "bank")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="card">Card</TabsTrigger>
                <TabsTrigger value="bank">Bank Account</TabsTrigger>
              </TabsList>
              <TabsContent value="card" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvc">CVC</Label>
                    <Input
                      id="cvc"
                      placeholder="123"
                      value={cardCvc}
                      onChange={(e) => setCardCvc(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddCard} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Card"
                    )}
                  </Button>
                </DialogFooter>
              </TabsContent>
              <TabsContent value="bank" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="routing">Routing Number</Label>
                  <Input
                    id="routing"
                    placeholder="123456789"
                    value={bankRouting}
                    onChange={(e) => setBankRouting(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="account">Account Number</Label>
                  <Input
                    id="account"
                    placeholder="1234567890"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountType">Account Type</Label>
                  <Select value={bankAccountType} onValueChange={setBankAccountType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="checking">Checking</SelectItem>
                      <SelectItem value="savings">Savings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button onClick={handleAddBank} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Bank Account"
                    )}
                  </Button>
                </DialogFooter>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Cards Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Cards</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {cards.length > 0 ? (
            cards.map((card) => {
              const config = statusConfig[card.status] || { label: card.status, color: "bg-gray-100" };
              return (
                <Card key={card.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center">
                          <CreditCard className="h-6 w-6 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {card.brand || "Card"} •••• {card.last4}
                            </p>
                            {card.isDefault && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Expires {card.expiryMonth}/{card.expiryYear}
                          </p>
                          <Badge className={`mt-2 ${config.color}`}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(card.id)}
                        disabled={deleteLoading === card.id}
                      >
                        {deleteLoading === card.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-2 border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No cards added yet</p>
                <p className="text-sm">Add a debit or credit card to make payments</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Bank Accounts Section */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Bank Accounts</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {banks.length > 0 ? (
            banks.map((bank) => {
              const config = statusConfig[bank.status] || { label: bank.status, color: "bg-gray-100" };
              return (
                <Card key={bank.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">
                              {bank.bankName || "Bank Account"} •••• {bank.last4}
                            </p>
                            {bank.isDefault && (
                              <Badge variant="secondary">Default</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {bank.accountType} Account
                          </p>
                          <Badge className={`mt-2 ${config.color}`}>
                            {config.label}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(bank.id)}
                        disabled={deleteLoading === bank.id}
                      >
                        {deleteLoading === bank.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <Card className="col-span-2 border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No bank accounts added yet</p>
                <p className="text-sm">Link a bank account for withdrawals</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
