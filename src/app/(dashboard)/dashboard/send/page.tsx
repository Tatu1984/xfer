"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Send,
  User,
  Mail,
  DollarSign,
  CheckCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const sendMoneySchema = z.object({
  recipient: z.string().min(1, "Recipient is required"),
  amount: z.string().min(1, "Amount is required").refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    "Amount must be a positive number"
  ),
  currency: z.string().min(1, "Currency is required"),
  note: z.string().max(200, "Note must be less than 200 characters").optional(),
});

type SendMoneyFormData = z.infer<typeof sendMoneySchema>;

interface WalletData {
  id: string;
  currency: string;
  balance: number;
  availableBalance: number;
}

interface WalletResponse {
  wallets: WalletData[];
  totals: {
    totalBalance: number;
    availableBalance: number;
  };
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

const fees = {
  USD: { percentage: 0, fixed: 0 },
  EUR: { percentage: 0.5, fixed: 0.25 },
  GBP: { percentage: 0.5, fixed: 0.20 },
  CAD: { percentage: 0.3, fixed: 0.15 },
};

export default function SendMoneyPage() {
  const router = useRouter();
  const [step, setStep] = useState<"form" | "confirm" | "success">("form");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<Recipient | null>(null);
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [recentRecipients, setRecentRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  useEffect(() => {
    async function fetchWallets() {
      try {
        const response = await fetch("/api/wallet");
        if (response.ok) {
          const data: WalletResponse = await response.json();
          setWallets(data.wallets);
        }
      } catch (err) {
        console.error("Failed to fetch wallets:", err);
      } finally {
        setLoadingWallets(false);
      }
    }

    async function fetchRecipients() {
      try {
        const response = await fetch("/api/transfers/recipients?limit=5");
        if (response.ok) {
          const data = await response.json();
          setRecentRecipients(data.recipients || []);
        }
      } catch (err) {
        console.error("Failed to fetch recipients:", err);
      } finally {
        setLoadingRecipients(false);
      }
    }

    fetchWallets();
    fetchRecipients();
  }, []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SendMoneyFormData>({
    resolver: zodResolver(sendMoneySchema),
    defaultValues: {
      recipient: "",
      amount: "",
      currency: "USD",
      note: "",
    },
  });

  const amount = watch("amount");
  const currency = watch("currency") as keyof typeof fees;
  const recipient = watch("recipient");

  const parsedAmount = parseFloat(amount) || 0;
  const fee = currency && fees[currency]
    ? parsedAmount * (fees[currency].percentage / 100) + fees[currency].fixed
    : 0;
  const total = parsedAmount + fee;
  const currentWallet = wallets.find(w => w.currency === currency);
  const balance = currentWallet?.availableBalance || 0;
  const hasSufficientBalance = total <= balance;

  const selectRecipient = (r: Recipient) => {
    setSelectedRecipient(r);
    setValue("recipient", r.email);
  };

  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferResult, setTransferResult] = useState<{
    referenceId: string;
    amount: number;
    fee: number;
  } | null>(null);

  const onSubmit = async (data: SendMoneyFormData) => {
    if (step === "form") {
      setStep("confirm");
    } else if (step === "confirm") {
      setIsProcessing(true);
      setTransferError(null);

      try {
        const response = await fetch("/api/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            recipientEmail: data.recipient,
            amount: parseFloat(data.amount),
            currency: data.currency,
            description: data.note || undefined,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Transfer failed");
        }

        setTransferResult(result);
        setStep("success");
      } catch (err) {
        setTransferError(err instanceof Error ? err.message : "Transfer failed");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  if (step === "success") {
    return (
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="pt-10 pb-10 text-center">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Money Sent!</h2>
            <p className="text-muted-foreground mb-6">
              You sent {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency,
              }).format(parsedAmount)} to {selectedRecipient?.name || recipient}
            </p>
            <div className="space-y-2">
              <Button className="w-full" onClick={() => router.push("/dashboard")}>
                Back to Dashboard
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("form");
                  setValue("recipient", "");
                  setValue("amount", "");
                  setValue("note", "");
                  setSelectedRecipient(null);
                }}
              >
                Send More Money
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Send Money</h1>
        <p className="text-muted-foreground">
          Transfer money to anyone with an email or phone
        </p>
      </div>

      {/* Balance Card */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: currency || "USD",
                }).format(balance)}
              </p>
            </div>
            <Badge variant="secondary">{currency || "USD"}</Badge>
          </div>
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)}>
        {step === "form" && (
          <Card>
            <CardHeader>
              <CardTitle>Transfer Details</CardTitle>
              <CardDescription>Enter the recipient and amount</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recent Recipients */}
              {!selectedRecipient && (
                <div>
                  <Label className="text-sm text-muted-foreground">Recent Recipients</Label>
                  <div className="flex gap-2 mt-2">
                    {loadingRecipients ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading recent recipients...</span>
                      </div>
                    ) : recentRecipients.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent recipients. Enter an email below.</p>
                    ) : (
                      recentRecipients.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => selectRecipient(r)}
                          className="flex flex-col items-center p-3 border rounded-lg hover:bg-muted transition-colors"
                        >
                          <Avatar className="h-10 w-10 mb-1">
                            <AvatarFallback>
                              {r.name.split(" ").map((n) => n[0]).join("").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{r.name.split(" ")[0]}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Recipient */}
              <div className="space-y-2">
                <Label htmlFor="recipient">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Recipient
                  </div>
                </Label>
                {selectedRecipient ? (
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>
                          {selectedRecipient.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{selectedRecipient.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedRecipient.email}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedRecipient(null);
                        setValue("recipient", "");
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <>
                    <Input
                      id="recipient"
                      placeholder="Email, phone, or username"
                      {...register("recipient")}
                    />
                    {errors.recipient && (
                      <p className="text-sm text-destructive">{errors.recipient.message}</p>
                    )}
                  </>
                )}
              </div>

              {/* Amount and Currency */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="amount">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Amount
                    </div>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="text-2xl h-14"
                    {...register("amount")}
                  />
                  {errors.amount && (
                    <p className="text-sm text-destructive">{errors.amount.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setValue("currency", value)}
                  >
                    <SelectTrigger className="h-14">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="CAD">CAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="What's this for?"
                  {...register("note")}
                />
              </div>

              {/* Fee Summary */}
              {parsedAmount > 0 && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Amount</span>
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency,
                      }).format(parsedAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Fee</span>
                    <span>
                      {fee === 0 ? "Free" : new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency,
                      }).format(fee)}
                    </span>
                  </div>
                  <div className="flex justify-between font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency,
                      }).format(total)}
                    </span>
                  </div>
                </div>
              )}

              {transferError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{transferError}</AlertDescription>
                </Alert>
              )}

              {!hasSufficientBalance && parsedAmount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Insufficient balance. You need{" "}
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency,
                    }).format(total - balance)}{" "}
                    more.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={!recipient || parsedAmount <= 0 || !hasSufficientBalance}
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === "confirm" && (
          <Card>
            <CardHeader>
              <CardTitle>Confirm Transfer</CardTitle>
              <CardDescription>Review the details before sending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-6">
                <p className="text-4xl font-bold">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency,
                  }).format(parsedAmount)}
                </p>
                <p className="text-muted-foreground mt-2">
                  to {selectedRecipient?.name || recipient}
                </p>
              </div>

              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Recipient</span>
                  <span className="font-medium">{selectedRecipient?.email || recipient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency,
                    }).format(parsedAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fee</span>
                  <span>{fee === 0 ? "Free" : new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency,
                  }).format(fee)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total</span>
                  <span>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency,
                    }).format(total)}
                  </span>
                </div>
              </div>

              {watch("note") && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Note</p>
                  <p className="mt-1">{watch("note")}</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("form")}
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={isProcessing}>
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Money
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}
      </form>
    </div>
  );
}
