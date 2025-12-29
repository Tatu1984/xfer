"use client";

import { useEffect, useState } from "react";
import {
  Wallet,
  Send,
  ArrowDownLeft,
  CreditCard,
  Plus,
  ArrowRight,
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
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface WalletData {
  id: string;
  currency: string;
  balance: number;
  availableBalance: number;
  pendingBalance: number;
  isDefault: boolean;
}

interface Transaction {
  id: string;
  referenceId: string;
  type: string;
  status: string;
  amount: number | string;
  currency: string;
  description: string | null;
  createdAt: string;
  sender?: { displayName: string; email: string } | null;
  receiver?: { displayName: string; email: string } | null;
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
  pagination: {
    total: number;
  };
}

interface ProfileData {
  kycStatus: string;
  emailVerified: boolean;
  phoneVerified: boolean;
}

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function UserDashboard() {
  const [walletData, setWalletData] = useState<WalletResponse | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [walletRes, txRes, profileRes] = await Promise.all([
          fetch("/api/wallet"),
          fetch("/api/transactions?limit=5"),
          fetch("/api/profile"),
        ]);

        if (!walletRes.ok || !txRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const [walletResult, txResult] = await Promise.all([
          walletRes.json() as Promise<WalletResponse>,
          txRes.json() as Promise<TransactionsResponse>,
        ]);

        setWalletData(walletResult);
        setTransactions(txResult.transactions);

        if (profileRes.ok) {
          const profileResult = await profileRes.json();
          setProfileData(profileResult.profile);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

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
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const defaultWallet = walletData?.wallets.find((w) => w.isDefault);
  const otherWallets = walletData?.wallets.filter((w) => !w.isDefault) || [];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s what&apos;s happening with your account
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/send">
              <Send className="mr-2 h-4 w-4" />
              Send Money
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/wallet">
              <Wallet className="mr-2 h-4 w-4" />
              View Wallet
            </Link>
          </Button>
        </div>
      </div>

      {/* Main Balance Card */}
      <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
        <CardHeader>
          <CardDescription className="text-primary-foreground/80">
            Available Balance
          </CardDescription>
          <CardTitle className="text-4xl">
            {formatCurrency(
              walletData?.totals.availableBalance || 0,
              walletData?.defaultCurrency || "USD"
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-primary-foreground/70">Pending: </span>
              <span className="font-medium">
                {formatCurrency(
                  walletData?.totals.pendingBalance || 0,
                  walletData?.defaultCurrency || "USD"
                )}
              </span>
            </div>
            <div>
              <span className="text-primary-foreground/70">Total: </span>
              <span className="font-medium">
                {formatCurrency(
                  walletData?.totals.totalBalance || 0,
                  walletData?.defaultCurrency || "USD"
                )}
              </span>
            </div>
          </div>

          <div className="flex gap-2 mt-6">
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard/send">
                <Send className="mr-2 h-4 w-4" />
                Send
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard/request">
                <ArrowDownLeft className="mr-2 h-4 w-4" />
                Request
              </Link>
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link href="/dashboard/wallet">
                <CreditCard className="mr-2 h-4 w-4" />
                Add Funds
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <Link href="/dashboard/send" className="block">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Send className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Send Money</p>
                <p className="text-sm text-muted-foreground">
                  Transfer to anyone
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <Link href="/dashboard/request" className="block">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <ArrowDownLeft className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Request Money</p>
                <p className="text-sm text-muted-foreground">Get paid easily</p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <Link href="/dashboard/wallet" className="block">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Cards & Banks</p>
                <p className="text-sm text-muted-foreground">
                  Manage payment methods
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
          <Link href="/dashboard/wallet" className="block">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <Plus className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Add Money</p>
                <p className="text-sm text-muted-foreground">
                  Fund your wallet
                </p>
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest transactions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/transactions">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const amount = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
                  const isOutgoing = tx.type.includes("OUT") || tx.type === "PAYMENT" || tx.type === "WITHDRAWAL";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-10 w-10 rounded-full flex items-center justify-center ${
                            isOutgoing
                              ? "bg-red-100 dark:bg-red-900"
                              : "bg-green-100 dark:bg-green-900"
                          }`}
                        >
                          {isOutgoing ? (
                            <Send className="h-5 w-5 text-red-600" />
                          ) : (
                            <ArrowDownLeft className="h-5 w-5 text-green-600" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {tx.description ||
                              (isOutgoing
                                ? tx.receiver?.displayName || tx.receiver?.email || "Payment"
                                : tx.sender?.displayName || tx.sender?.email || "Received")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-medium ${
                            isOutgoing ? "text-red-600" : "text-green-600"
                          }`}
                        >
                          {isOutgoing ? "-" : "+"}
                          {formatCurrency(amount, tx.currency)}
                        </p>
                        <Badge
                          variant={
                            tx.status === "COMPLETED" ? "default" : "secondary"
                          }
                          className="text-xs"
                        >
                          {tx.status}
                        </Badge>
                      </div>
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

        {/* Wallets Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Wallets</CardTitle>
              <CardDescription>Multi-currency balances</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/wallet">
                <Plus className="mr-2 h-4 w-4" />
                Add Currency
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {defaultWallet && (
                <div className="p-4 rounded-lg border bg-muted/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        {defaultWallet.currency}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    </div>
                    <span className="text-lg font-bold">
                      {formatCurrency(
                        defaultWallet.balance,
                        defaultWallet.currency
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>
                      Available:{" "}
                      {formatCurrency(
                        defaultWallet.availableBalance,
                        defaultWallet.currency
                      )}
                    </span>
                    <span>
                      Pending:{" "}
                      {formatCurrency(
                        defaultWallet.pendingBalance,
                        defaultWallet.currency
                      )}
                    </span>
                  </div>
                </div>
              )}

              {otherWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <span className="font-medium">{wallet.currency}</span>
                  <span className="font-medium">
                    {formatCurrency(wallet.balance, wallet.currency)}
                  </span>
                </div>
              ))}

              {(!walletData || walletData.wallets.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No wallets found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KYC Progress - Show if not fully verified */}
      {profileData && profileData.kycStatus !== "APPROVED" && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Complete Your Profile</CardTitle>
            <CardDescription>
              Verify your identity to unlock all features
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Progress
                value={
                  profileData.emailVerified && profileData.phoneVerified && profileData.kycStatus === "PENDING"
                    ? 66
                    : profileData.emailVerified && profileData.phoneVerified
                    ? 50
                    : profileData.emailVerified
                    ? 25
                    : 0
                }
                className="h-2"
              />
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                    profileData.emailVerified ? "bg-green-500" : "bg-muted"
                  }`}>
                    {profileData.emailVerified ? (
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="text-xs font-medium">1</span>
                    )}
                  </div>
                  <span className={`text-sm ${profileData.emailVerified ? "" : "text-muted-foreground"}`}>
                    Email {profileData.emailVerified ? "Verified" : "Verification"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                    profileData.phoneVerified ? "bg-green-500" : "bg-muted"
                  }`}>
                    {profileData.phoneVerified ? (
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      <span className="text-xs font-medium">2</span>
                    )}
                  </div>
                  <span className={`text-sm ${profileData.phoneVerified ? "" : "text-muted-foreground"}`}>
                    Phone {profileData.phoneVerified ? "Verified" : "Verification"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                    profileData.kycStatus === "APPROVED" ? "bg-green-500" :
                    profileData.kycStatus === "PENDING" ? "bg-yellow-500" : "bg-muted"
                  }`}>
                    {profileData.kycStatus === "APPROVED" ? (
                      <svg
                        className="h-4 w-4 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : profileData.kycStatus === "PENDING" ? (
                      <Loader2 className="h-3 w-3 text-white animate-spin" />
                    ) : (
                      <span className="text-xs font-medium">3</span>
                    )}
                  </div>
                  <span className={`text-sm ${
                    profileData.kycStatus === "APPROVED" ? "" :
                    profileData.kycStatus === "PENDING" ? "text-yellow-600" : "text-muted-foreground"
                  }`}>
                    {profileData.kycStatus === "APPROVED" ? "ID Verified" :
                     profileData.kycStatus === "PENDING" ? "ID Pending Review" :
                     profileData.kycStatus === "REJECTED" ? "ID Rejected" : "ID Verification"}
                  </span>
                </div>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/profile">
                  {profileData.kycStatus === "PENDING" ? "Check Status" : "Continue Verification"}
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
