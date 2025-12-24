"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, ArrowUpRight, ArrowDownLeft, Send, Clock } from "lucide-react";
import Link from "next/link";

const transactions = [
  {
    id: "TXN001",
    type: "CREDIT",
    description: "Order #1234 payment",
    amount: 125.00,
    status: "COMPLETED",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "TXN002",
    type: "DEBIT",
    description: "Payout to bank",
    amount: 500.00,
    status: "COMPLETED",
    createdAt: "2024-01-14T16:00:00Z",
  },
  {
    id: "TXN003",
    type: "CREDIT",
    description: "Order #1235 payment",
    amount: 89.99,
    status: "COMPLETED",
    createdAt: "2024-01-14T14:00:00Z",
  },
  {
    id: "TXN004",
    type: "DEBIT",
    description: "Payout to bank",
    amount: 1000.00,
    status: "PENDING",
    createdAt: "2024-01-13T10:00:00Z",
  },
];

export default function VendorBalancePage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance</h1>
          <p className="text-muted-foreground">
            Manage your account balance
          </p>
        </div>
        <Link href="/vendor/payouts">
          <Button>
            <Send className="mr-2 h-4 w-4" />
            Request Payout
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(2450.00)}</div>
            <p className="text-xs text-muted-foreground">Ready to withdraw</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(1000.00)}</div>
            <p className="text-xs text-muted-foreground">Being processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(15680.00)}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your balance activity</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {txn.type === "CREDIT" ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      )}
                      <span>{txn.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{txn.description}</TableCell>
                  <TableCell className={txn.type === "CREDIT" ? "text-green-600" : "text-red-600"}>
                    {txn.type === "CREDIT" ? "+" : "-"}{formatCurrency(txn.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={txn.status === "COMPLETED" ? "default" : "secondary"}>
                      {txn.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(txn.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
