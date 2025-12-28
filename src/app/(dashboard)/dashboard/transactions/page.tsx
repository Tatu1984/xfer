"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Filter,
  MoreHorizontal,
  RefreshCw,
  Loader2,
  Eye,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/dashboard/data-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

interface Transaction {
  id: string;
  referenceId: string;
  type: string;
  status: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  sender?: { displayName: string; email: string } | null;
  receiver?: { displayName: string; email: string } | null;
}

interface TransactionsResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const typeConfig: Record<string, { label: string; icon: typeof ArrowDownLeft; color: string; isPositive: boolean }> = {
  TRANSFER_IN: { label: "Received", icon: ArrowDownLeft, color: "text-green-600 bg-green-100", isPositive: true },
  TRANSFER_OUT: { label: "Sent", icon: ArrowUpRight, color: "text-red-600 bg-red-100", isPositive: false },
  DEPOSIT: { label: "Deposit", icon: ArrowDownLeft, color: "text-blue-600 bg-blue-100", isPositive: true },
  WITHDRAWAL: { label: "Withdrawal", icon: ArrowUpRight, color: "text-orange-600 bg-orange-100", isPositive: false },
  PAYMENT: { label: "Payment", icon: ArrowUpRight, color: "text-purple-600 bg-purple-100", isPositive: false },
  REFUND: { label: "Refund", icon: ArrowDownLeft, color: "text-green-600 bg-green-100", isPositive: true },
  PAYOUT: { label: "Payout", icon: ArrowUpRight, color: "text-orange-600 bg-orange-100", isPositive: false },
  FEE: { label: "Fee", icon: ArrowUpRight, color: "text-gray-600 bg-gray-100", isPositive: false },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  FAILED: { label: "Failed", color: "bg-red-100 text-red-800" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800" },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-blue-800" },
};

function getColumns(
  onViewDetails: (tx: Transaction) => void,
  onDownloadReceipt: (tx: Transaction) => void,
  onReportIssue: (tx: Transaction) => void
): ColumnDef<Transaction>[] {
  return [
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return (
          <div>
            <p className="font-medium">
              {date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("type") as string;
        const config = typeConfig[type] || { label: type, icon: ArrowUpRight, color: "text-gray-600 bg-gray-100" };
        const Icon = config.icon;
        return (
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${config.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <span>{config.label}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const transaction = row.original;
        const type = transaction.type;
        const isOutgoing = type.includes("OUT") || type === "PAYMENT" || type === "WITHDRAWAL" || type === "PAYOUT";
        const counterparty = isOutgoing
          ? transaction.receiver?.displayName || transaction.receiver?.email
          : transaction.sender?.displayName || transaction.sender?.email;
        return (
          <div>
            <p className="font-medium">{transaction.description || "Transaction"}</p>
            <p className="text-xs text-muted-foreground">{counterparty || "—"}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "referenceId",
      header: "Reference",
      cell: ({ row }) => (
        <code className="text-xs bg-muted px-2 py-1 rounded">
          {row.getValue("referenceId")}
        </code>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const config = statusConfig[status] || { label: status, color: "bg-gray-100 text-gray-800" };
        return (
          <Badge className={config.color}>
            {config.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: "amount",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="w-full justify-end"
        >
          Amount
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const transaction = row.original;
        const type = transaction.type;
        const config = typeConfig[type];
        const isPositive = config?.isPositive ?? false;
        const formatted = new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: transaction.currency,
        }).format(transaction.amount);
        return (
          <div className="text-right">
            <p className={`font-medium ${isPositive ? "text-green-600" : ""}`}>
              {isPositive ? "+" : "-"}{formatted}
            </p>
            {transaction.fee > 0 && (
              <p className="text-xs text-muted-foreground">
                Fee: ${transaction.fee.toFixed(2)}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const transaction = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(transaction.referenceId)}>
                Copy Reference
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewDetails(transaction)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownloadReceipt(transaction)}>
                <FileText className="mr-2 h-4 w-4" />
                Download Receipt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReportIssue(transaction)}>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Report Issue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "50",
        page: pagination.page.toString(),
      });
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/transactions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch transactions");

      const data: TransactionsResponse = await response.json();
      setTransactions(data.transactions);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [typeFilter, statusFilter, pagination.page]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch("/api/exports?type=transactions&format=csv");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success("Export downloaded successfully");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Failed to export transactions");
    } finally {
      setExporting(false);
    }
  };

  const handleViewDetails = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setDetailsDialogOpen(true);
  };

  const handleDownloadReceipt = async (tx: Transaction) => {
    toast.success(`Receipt for ${tx.referenceId} - Feature coming soon`);
  };

  const handleReportIssue = (tx: Transaction) => {
    window.location.href = `/dashboard/disputes/new?transactionId=${tx.id}`;
  };

  const totalIncoming = transactions
    .filter((tx) => (typeConfig[tx.type]?.isPositive) && tx.status === "COMPLETED")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalOutgoing = transactions
    .filter((tx) => !(typeConfig[tx.type]?.isPositive) && tx.status === "COMPLETED")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const columns = getColumns(handleViewDetails, handleDownloadReceipt, handleReportIssue);

  if (loading && transactions.length === 0) {
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
          <Button onClick={fetchTransactions} className="mt-4">
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
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            View and manage your payment history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export
          </Button>
          <Button variant="outline" onClick={fetchTransactions} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Received</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              +${totalIncoming.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Sent</CardDescription>
            <CardTitle className="text-2xl text-red-600">
              -${totalOutgoing.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net Change</CardDescription>
            <CardTitle className={`text-2xl ${totalIncoming - totalOutgoing >= 0 ? "text-green-600" : "text-red-600"}`}>
              {totalIncoming - totalOutgoing >= 0 ? "+" : ""}
              ${(totalIncoming - totalOutgoing).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="TRANSFER_IN">Received</SelectItem>
              <SelectItem value="TRANSFER_OUT">Sent</SelectItem>
              <SelectItem value="DEPOSIT">Deposits</SelectItem>
              <SelectItem value="WITHDRAWAL">Withdrawals</SelectItem>
              <SelectItem value="PAYMENT">Payments</SelectItem>
              <SelectItem value="REFUND">Refunds</SelectItem>
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
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(typeFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTypeFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          {pagination.total} transactions
        </div>
      </div>

      <DataTable
        columns={columns}
        data={transactions}
        searchKey="description"
        searchPlaceholder="Search transactions..."
      />

      {/* Transaction Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              Reference: {selectedTransaction?.referenceId}
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">{typeConfig[selectedTransaction.type]?.label || selectedTransaction.type}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedTransaction.status]?.color}>
                    {statusConfig[selectedTransaction.status]?.label || selectedTransaction.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="font-medium text-lg">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: selectedTransaction.currency,
                    }).format(selectedTransaction.amount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fee</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: selectedTransaction.currency,
                    }).format(selectedTransaction.fee)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Amount</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: selectedTransaction.currency,
                    }).format(selectedTransaction.netAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {new Date(selectedTransaction.createdAt).toLocaleString()}
                  </p>
                </div>
                {selectedTransaction.sender && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="font-medium">{selectedTransaction.sender.displayName}</p>
                    <p className="text-sm text-muted-foreground">{selectedTransaction.sender.email}</p>
                  </div>
                )}
                {selectedTransaction.receiver && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">To</p>
                    <p className="font-medium">{selectedTransaction.receiver.displayName}</p>
                    <p className="text-sm text-muted-foreground">{selectedTransaction.receiver.email}</p>
                  </div>
                )}
                {selectedTransaction.description && (
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-medium">{selectedTransaction.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
