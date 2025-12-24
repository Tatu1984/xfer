"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Plus,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Send,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Dispute {
  id: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  transaction: {
    id: string;
    referenceId: string;
    amount: number;
    currency: string;
    type: string;
    createdAt: string;
  };
  messages: Array<{
    id: string;
    content: string;
    senderType: string;
    createdAt: string;
  }>;
}

interface Transaction {
  id: string;
  referenceId: string;
  amount: number;
  currency: string;
  type: string;
  createdAt: string;
}

interface DisputesResponse {
  disputes: Dispute[];
}

interface TransactionsResponse {
  transactions: Transaction[];
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  OPEN: { label: "Open", color: "bg-blue-100 text-blue-800", icon: Clock },
  UNDER_REVIEW: { label: "Under Review", color: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
  RESOLVED_BUYER: { label: "Resolved - Buyer", color: "bg-green-100 text-green-800", icon: CheckCircle },
  RESOLVED_SELLER: { label: "Resolved - Seller", color: "bg-green-100 text-green-800", icon: CheckCircle },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

const reasonLabels: Record<string, string> = {
  ITEM_NOT_RECEIVED: "Item Not Received",
  ITEM_NOT_AS_DESCRIBED: "Item Not as Described",
  UNAUTHORIZED_TRANSACTION: "Unauthorized Transaction",
  BILLING_ISSUE: "Billing Issue",
  OTHER: "Other",
};

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Form states
  const [selectedTransaction, setSelectedTransaction] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const fetchDisputes = async () => {
    try {
      const response = await fetch("/api/disputes");
      if (!response.ok) throw new Error("Failed to fetch disputes");
      const data: DisputesResponse = await response.json();
      setDisputes(data.disputes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch("/api/transactions?limit=50");
      if (!response.ok) throw new Error("Failed to fetch transactions");
      const data: TransactionsResponse = await response.json();
      setTransactions(data.transactions);
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    }
  };

  useEffect(() => {
    fetchDisputes();
    fetchTransactions();
  }, []);

  const handleCreateDispute = async () => {
    if (!selectedTransaction || !disputeReason || !disputeDescription) {
      alert("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: selectedTransaction,
          reason: disputeReason,
          description: disputeDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create dispute");
      }

      setCreateDialogOpen(false);
      setSelectedTransaction("");
      setDisputeReason("");
      setDisputeDescription("");
      fetchDisputes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create dispute");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDispute || !newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/disputes/${selectedDispute.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setNewMessage("");
      // Refresh dispute details
      const disputeResponse = await fetch(`/api/disputes/${selectedDispute.id}`);
      if (disputeResponse.ok) {
        const disputeData = await disputeResponse.json();
        setSelectedDispute(disputeData.dispute);
      }
      fetchDisputes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const openDisputeDetails = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setDetailDialogOpen(true);
    // Fetch latest dispute details with messages
    try {
      const response = await fetch(`/api/disputes/${dispute.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDispute(data.dispute);
      }
    } catch (err) {
      console.error("Failed to fetch dispute details:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openDisputes = disputes.filter(d => d.status === "OPEN" || d.status === "UNDER_REVIEW");
  const closedDisputes = disputes.filter(d => d.status !== "OPEN" && d.status !== "UNDER_REVIEW");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disputes</h1>
          <p className="text-muted-foreground">
            View and manage transaction disputes
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Open Dispute
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Open a Dispute</DialogTitle>
              <DialogDescription>
                Submit a dispute for a transaction you have concerns about
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Transaction</Label>
                <Select value={selectedTransaction} onValueChange={setSelectedTransaction}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a transaction" />
                  </SelectTrigger>
                  <SelectContent>
                    {transactions.map((tx) => (
                      <SelectItem key={tx.id} value={tx.id}>
                        {tx.referenceId} - {formatCurrency(tx.amount, tx.currency)} ({tx.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={disputeReason} onValueChange={setDisputeReason}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITEM_NOT_RECEIVED">Item Not Received</SelectItem>
                    <SelectItem value="ITEM_NOT_AS_DESCRIBED">Item Not as Described</SelectItem>
                    <SelectItem value="UNAUTHORIZED_TRANSACTION">Unauthorized Transaction</SelectItem>
                    <SelectItem value="BILLING_ISSUE">Billing Issue</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Describe your issue in detail..."
                  value={disputeDescription}
                  onChange={(e) => setDisputeDescription(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateDispute} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Dispute"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Open Disputes */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Active Disputes ({openDisputes.length})</h2>
        {openDisputes.length > 0 ? (
          <div className="space-y-4">
            {openDisputes.map((dispute) => {
              const config = statusConfig[dispute.status] || statusConfig.OPEN;
              const StatusIcon = config.icon;
              return (
                <Card key={dispute.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openDisputeDetails(dispute)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                          <AlertTriangle className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{reasonLabels[dispute.reason] || dispute.reason}</p>
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Transaction: {dispute.transaction.referenceId} • {formatCurrency(dispute.transaction.amount, dispute.transaction.currency)}
                          </p>
                          <p className="text-sm line-clamp-2">{dispute.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {formatDate(dispute.createdAt)}
                        </p>
                        {dispute.messages.length > 0 && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                            <MessageSquare className="h-3 w-3" />
                            {dispute.messages.length} messages
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No active disputes</p>
              <p className="text-sm">All your transactions are dispute-free</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Closed Disputes */}
      {closedDisputes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Closed Disputes ({closedDisputes.length})</h2>
          <div className="space-y-4">
            {closedDisputes.map((dispute) => {
              const config = statusConfig[dispute.status] || statusConfig.CLOSED;
              const StatusIcon = config.icon;
              return (
                <Card key={dispute.id} className="cursor-pointer hover:bg-muted/50 transition-colors opacity-75" onClick={() => openDisputeDetails(dispute)}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
                          <FileText className="h-6 w-6 text-gray-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{reasonLabels[dispute.reason] || dispute.reason}</p>
                            <Badge className={config.color}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Transaction: {dispute.transaction.referenceId} • {formatCurrency(dispute.transaction.amount, dispute.transaction.currency)}
                          </p>
                          {dispute.resolution && (
                            <p className="text-sm mt-2">
                              <span className="font-medium">Resolution:</span> {dispute.resolution}
                            </p>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(dispute.updatedAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Dispute Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {reasonLabels[selectedDispute.reason] || selectedDispute.reason}
                  <Badge className={statusConfig[selectedDispute.status]?.color || "bg-gray-100"}>
                    {statusConfig[selectedDispute.status]?.label || selectedDispute.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Dispute opened on {formatDate(selectedDispute.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                {/* Transaction Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Transaction Details</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reference:</span>{" "}
                      {selectedDispute.transaction.referenceId}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      {formatCurrency(selectedDispute.transaction.amount, selectedDispute.transaction.currency)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>{" "}
                      {selectedDispute.transaction.type}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date:</span>{" "}
                      {formatDate(selectedDispute.transaction.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <p className="text-sm font-medium mb-2">Description</p>
                  <p className="text-sm text-muted-foreground">{selectedDispute.description}</p>
                </div>

                {/* Resolution */}
                {selectedDispute.resolution && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium mb-1 text-green-800">Resolution</p>
                    <p className="text-sm text-green-700">{selectedDispute.resolution}</p>
                  </div>
                )}

                {/* Messages */}
                <div>
                  <p className="text-sm font-medium mb-2">Messages ({selectedDispute.messages.length})</p>
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {selectedDispute.messages.length > 0 ? (
                      selectedDispute.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.senderType === "USER"
                              ? "bg-primary/10 ml-8"
                              : "bg-muted mr-8"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.senderType === "USER" ? "You" : msg.senderType === "ADMIN" ? "Support" : "System"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No messages yet
                      </p>
                    )}
                  </div>
                </div>

                {/* Send Message (only for open disputes) */}
                {(selectedDispute.status === "OPEN" || selectedDispute.status === "UNDER_REVIEW") && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    />
                    <Button onClick={handleSendMessage} disabled={sendingMessage || !newMessage.trim()}>
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
