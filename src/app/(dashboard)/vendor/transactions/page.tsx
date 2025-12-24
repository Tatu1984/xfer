"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const transactions = [
  {
    id: "TXN001",
    type: "PAYMENT",
    order: "#1234",
    customer: "john@example.com",
    amount: 125.00,
    fee: 3.75,
    net: 121.25,
    status: "COMPLETED",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "TXN002",
    type: "PAYOUT",
    order: null,
    customer: null,
    amount: 500.00,
    fee: 0,
    net: 500.00,
    status: "COMPLETED",
    createdAt: "2024-01-14T16:00:00Z",
  },
  {
    id: "TXN003",
    type: "PAYMENT",
    order: "#1235",
    customer: "jane@example.com",
    amount: 89.99,
    fee: 2.70,
    net: 87.29,
    status: "COMPLETED",
    createdAt: "2024-01-14T14:00:00Z",
  },
  {
    id: "TXN004",
    type: "REFUND",
    order: "#1230",
    customer: "mike@example.com",
    amount: 45.00,
    fee: 0,
    net: -45.00,
    status: "COMPLETED",
    createdAt: "2024-01-13T10:00:00Z",
  },
];

export default function VendorTransactionsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      txn.id.toLowerCase().includes(search.toLowerCase()) ||
      (txn.customer && txn.customer.toLowerCase().includes(search.toLowerCase())) ||
      (txn.order && txn.order.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === "all" || txn.type === typeFilter;
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            View your transaction history
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>All your business transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PAYMENT">Payment</SelectItem>
                <SelectItem value="PAYOUT">Payout</SelectItem>
                <SelectItem value="REFUND">Refund</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell className="font-mono text-sm">{txn.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {txn.type === "PAYMENT" ? (
                        <ArrowDownLeft className="h-4 w-4 text-green-500" />
                      ) : txn.type === "REFUND" ? (
                        <ArrowUpRight className="h-4 w-4 text-red-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-blue-500" />
                      )}
                      <span>{txn.type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{txn.order || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {txn.customer || "-"}
                  </TableCell>
                  <TableCell>{formatCurrency(txn.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {txn.fee > 0 ? `-${formatCurrency(txn.fee)}` : "-"}
                  </TableCell>
                  <TableCell className={txn.net >= 0 ? "text-green-600" : "text-red-600"}>
                    {txn.net >= 0 ? "+" : ""}{formatCurrency(txn.net)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{txn.status}</Badge>
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
