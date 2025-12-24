"use client";

import { useState, useEffect } from "react";
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
import { Search, Download, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  referenceId: string;
  type: string;
  sender: string;
  receiver: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export default function AdminTransactionsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch("/api/admin/transactions");
      if (response.ok) {
        const data = await response.json();
        interface ApiTransaction {
          id: string;
          referenceId: string;
          type: string;
          sender?: { email?: string };
          senderWallet?: { user?: { email?: string } };
          receiver?: { email?: string };
          receiverWallet?: { user?: { email?: string } };
          amount: number | string;
          currency?: string;
          status: string;
          createdAt: string;
        }
        setTransactions(data.transactions.map((tx: ApiTransaction) => ({
          id: tx.id,
          referenceId: tx.referenceId,
          type: tx.type,
          sender: tx.sender?.email || tx.senderWallet?.user?.email || "External",
          receiver: tx.receiver?.email || tx.receiverWallet?.user?.email || "External",
          amount: Number(tx.amount),
          currency: tx.currency || "USD",
          status: tx.status,
          createdAt: tx.createdAt,
        })));
      } else {
        // Mock data fallback
        setTransactions([
          {
            id: "1",
            referenceId: "TXN001",
            type: "TRANSFER",
            sender: "john@example.com",
            receiver: "jane@example.com",
            amount: 250.00,
            currency: "USD",
            status: "COMPLETED",
            createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "2",
            referenceId: "TXN002",
            type: "DEPOSIT",
            sender: "Bank ****1234",
            receiver: "mike@example.com",
            amount: 1000.00,
            currency: "USD",
            status: "COMPLETED",
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "3",
            referenceId: "TXN003",
            type: "WITHDRAWAL",
            sender: "sarah@example.com",
            receiver: "Bank ****5678",
            amount: 500.00,
            currency: "USD",
            status: "PENDING",
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          },
        ]);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter((txn) => {
    const matchesSearch =
      txn.referenceId.toLowerCase().includes(search.toLowerCase()) ||
      txn.sender.toLowerCase().includes(search.toLowerCase()) ||
      txn.receiver.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || txn.status === statusFilter;
    const matchesType = typeFilter === "all" || txn.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleExport = () => {
    if (filteredTransactions.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no transactions matching your filters",
        variant: "destructive",
      });
      return;
    }

    // Create CSV content
    const headers = ["Reference ID", "Type", "From", "To", "Amount", "Currency", "Status", "Date"];
    const csvContent = [
      headers.join(","),
      ...filteredTransactions.map((txn) =>
        [
          txn.referenceId,
          txn.type,
          `"${txn.sender}"`,
          `"${txn.receiver}"`,
          txn.amount.toFixed(2),
          txn.currency,
          txn.status,
          new Date(txn.createdAt).toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${filteredTransactions.length} transactions`,
    });
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "DEPOSIT":
      case "TRANSFER_IN":
        return <ArrowDownLeft className="h-4 w-4 text-green-500" />;
      case "WITHDRAWAL":
      case "TRANSFER_OUT":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      default:
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const totalVolume = transactions
    .filter((t) => t.status === "COMPLETED")
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage platform transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchTransactions}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalVolume)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transactions.filter((t) => t.status === "COMPLETED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transactions.filter((t) => t.status === "PENDING").length}
            </div>
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
              </SelectContent>
            </Select>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10">
              <ArrowLeftRight className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No transactions found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "No transactions have been made yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="font-mono text-sm">{txn.referenceId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(txn.type)}
                        <span>{txn.type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{txn.sender}</TableCell>
                    <TableCell className="text-muted-foreground">{txn.receiver}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(txn.amount, txn.currency)}</TableCell>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
