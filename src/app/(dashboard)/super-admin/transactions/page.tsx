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
import { Search, Download, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";

const transactions = [
  {
    id: "TXN001",
    type: "TRANSFER",
    sender: "john@example.com",
    receiver: "jane@example.com",
    amount: 250.00,
    currency: "USD",
    status: "COMPLETED",
    fee: 2.50,
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "TXN002",
    type: "DEPOSIT",
    sender: "Bank Account ****1234",
    receiver: "mike@example.com",
    amount: 1000.00,
    currency: "USD",
    status: "COMPLETED",
    fee: 0,
    createdAt: "2024-01-15T09:15:00Z",
  },
  {
    id: "TXN003",
    type: "WITHDRAWAL",
    sender: "sarah@example.com",
    receiver: "Bank Account ****5678",
    amount: 500.00,
    currency: "USD",
    status: "PENDING",
    fee: 1.50,
    createdAt: "2024-01-15T08:45:00Z",
  },
  {
    id: "TXN004",
    type: "PAYMENT",
    sender: "customer@example.com",
    receiver: "Tech Solutions Inc",
    amount: 89.99,
    currency: "USD",
    status: "COMPLETED",
    fee: 2.70,
    createdAt: "2024-01-14T16:20:00Z",
  },
  {
    id: "TXN005",
    type: "REFUND",
    sender: "Fashion Store",
    receiver: "buyer@example.com",
    amount: 45.00,
    currency: "USD",
    status: "COMPLETED",
    fee: 0,
    createdAt: "2024-01-14T14:00:00Z",
  },
];

export default function SuperAdminTransactionsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      txn.id.toLowerCase().includes(search.toLowerCase()) ||
      txn.sender.toLowerCase().includes(search.toLowerCase()) ||
      txn.receiver.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || txn.status === statusFilter;
    const matchesType = typeFilter === "all" || txn.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "DEPOSIT":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "WITHDRAWAL":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      default:
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Transactions</h1>
          <p className="text-muted-foreground">
            Monitor and manage platform transactions
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Volume (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$125,430</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Transactions (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Fees (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$2,450</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>All platform transactions</CardDescription>
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
                <SelectItem value="TRANSFER">Transfer</SelectItem>
                <SelectItem value="DEPOSIT">Deposit</SelectItem>
                <SelectItem value="WITHDRAWAL">Withdrawal</SelectItem>
                <SelectItem value="PAYMENT">Payment</SelectItem>
                <SelectItem value="REFUND">Refund</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Fee</TableHead>
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
                      {getTypeIcon(txn.type)}
                      <span>{txn.type}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{txn.sender}</TableCell>
                  <TableCell className="text-muted-foreground">{txn.receiver}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(txn.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatCurrency(txn.fee)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        txn.status === "COMPLETED"
                          ? "default"
                          : txn.status === "PENDING"
                          ? "secondary"
                          : "destructive"
                      }
                    >
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
