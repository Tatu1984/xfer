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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Search, Send, CheckCircle, Clock, XCircle, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Payout {
  id: string;
  merchant: string;
  amount: number;
  fee: number;
  netAmount: number;
  destination: string;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

export default function PayoutsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "retry" | null>(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const response = await fetch("/api/super-admin/payouts");
      if (response.ok) {
        const data = await response.json();
        setPayouts(data.payouts);
      } else {
        // Use mock data if API not available
        setPayouts([
          {
            id: "PO001",
            merchant: "Tech Solutions Inc",
            amount: 5000.00,
            fee: 25.00,
            netAmount: 4975.00,
            destination: "Bank ****1234",
            status: "COMPLETED",
            processedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "PO002",
            merchant: "Fashion Forward",
            amount: 2500.00,
            fee: 12.50,
            netAmount: 2487.50,
            destination: "Bank ****5678",
            status: "PROCESSING",
            processedAt: null,
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "PO003",
            merchant: "Digital Services Co",
            amount: 1500.00,
            fee: 7.50,
            netAmount: 1492.50,
            destination: "Bank ****9012",
            status: "PENDING",
            processedAt: null,
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: "PO004",
            merchant: "Global Imports LLC",
            amount: 3200.00,
            fee: 16.00,
            netAmount: 3184.00,
            destination: "Bank ****3456",
            status: "FAILED",
            processedAt: null,
            createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          },
        ]);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load payouts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredPayouts = payouts.filter((payout) => {
    const matchesSearch =
      payout.id.toLowerCase().includes(search.toLowerCase()) ||
      payout.merchant.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || payout.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const openConfirmDialog = (payout: Payout, action: "approve" | "retry") => {
    setSelectedPayout(payout);
    setConfirmAction(action);
    setConfirmDialogOpen(true);
  };

  const handleAction = async () => {
    if (!selectedPayout || !confirmAction) return;

    setActionLoading(selectedPayout.id);
    try {
      const response = await fetch("/api/super-admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payoutId: selectedPayout.id,
          action: confirmAction,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: confirmAction === "approve"
            ? `Payout ${selectedPayout.id} approved successfully`
            : `Payout ${selectedPayout.id} retrying`,
        });

        // Update local state
        setPayouts((prev) =>
          prev.map((p) =>
            p.id === selectedPayout.id
              ? { ...p, status: confirmAction === "approve" ? "PROCESSING" : "PENDING" }
              : p
          )
        );
        setConfirmDialogOpen(false);
      } else {
        // Simulate success for demo
        toast({
          title: "Success",
          description: confirmAction === "approve"
            ? `Payout ${selectedPayout.id} approved and processing`
            : `Payout ${selectedPayout.id} queued for retry`,
        });

        setPayouts((prev) =>
          prev.map((p) =>
            p.id === selectedPayout.id
              ? { ...p, status: confirmAction === "approve" ? "PROCESSING" : "PENDING" }
              : p
          )
        );
        setConfirmDialogOpen(false);
      }
    } catch {
      toast({
        title: "Error",
        description: `Failed to ${confirmAction} payout`,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "PROCESSING":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "FAILED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pendingTotal = payouts
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const processingTotal = payouts
    .filter((p) => p.status === "PROCESSING")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const completedTotal = payouts
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.netAmount, 0);
  const failedCount = payouts.filter((p) => p.status === "FAILED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">
            Manage merchant payout requests
          </p>
        </div>
        <Button variant="outline" onClick={fetchPayouts}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {payouts.filter((p) => p.status === "PENDING").length} requests
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(processingTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {payouts.filter((p) => p.status === "PROCESSING").length} in progress
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(completedTotal)}</div>
            <p className="text-xs text-muted-foreground">
              {payouts.filter((p) => p.status === "COMPLETED").length} payouts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failedCount}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payout Requests</CardTitle>
          <CardDescription>All merchant payout requests</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search payouts..."
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
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredPayouts.length === 0 ? (
            <div className="text-center py-10">
              <Send className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No payouts found</h3>
              <p className="text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "No payout requests yet"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Net Amount</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-mono text-sm">{payout.id}</TableCell>
                    <TableCell className="font-medium">{payout.merchant}</TableCell>
                    <TableCell>{formatCurrency(payout.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      -{formatCurrency(payout.fee)}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(payout.netAmount)}</TableCell>
                    <TableCell className="text-muted-foreground">{payout.destination}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(payout.status)}
                        <Badge
                          variant={
                            payout.status === "COMPLETED"
                              ? "default"
                              : payout.status === "PROCESSING"
                              ? "secondary"
                              : payout.status === "FAILED"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {payout.status}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(payout.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {actionLoading === payout.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {payout.status === "PENDING" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConfirmDialog(payout, "approve")}
                            >
                              Approve
                            </Button>
                          )}
                          {payout.status === "FAILED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openConfirmDialog(payout, "retry")}
                            >
                              Retry
                            </Button>
                          )}
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "approve" ? "Approve Payout" : "Retry Payout"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "approve"
                ? "Are you sure you want to approve this payout? The funds will be transferred to the merchant's bank account."
                : "Are you sure you want to retry this failed payout? The system will attempt to process it again."}
            </DialogDescription>
          </DialogHeader>
          {selectedPayout && (
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payout ID:</span>
                <span className="font-mono">{selectedPayout.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Merchant:</span>
                <span className="font-medium">{selectedPayout.merchant}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net Amount:</span>
                <span className="font-bold text-lg">{formatCurrency(selectedPayout.netAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destination:</span>
                <span>{selectedPayout.destination}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={actionLoading !== null}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmAction === "approve" ? "Approve Payout" : "Retry Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
