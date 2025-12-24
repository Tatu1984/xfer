"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  MessageSquare,
  DollarSign,
  Send,
  AlertCircle,
  User,
  RefreshCw,
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
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Dispute {
  id: string;
  reason: string;
  description: string;
  status: string;
  resolution: string | null;
  amount: number | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  transaction: {
    id: string;
    referenceId: string;
    amount: number;
    currency: string;
    type: string;
    status: string;
    createdAt: string;
    sender: {
      email: string;
      displayName: string;
    } | null;
    recipient: {
      email: string;
      displayName: string;
    } | null;
  };
  messages: Array<{
    id: string;
    content: string;
    senderType: string;
    senderId: string;
    createdAt: string;
  }>;
}

interface DisputesResponse {
  disputes: Dispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
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

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [resolution, setResolution] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchDisputes = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: "20",
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/admin/disputes?${params}`);
      if (!response.ok) throw new Error("Failed to fetch disputes");

      const data: DisputesResponse = await response.json();
      setDisputes(data.disputes);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load disputes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter, pagination.page]);

  const handleResolve = async (resolutionType: "RESOLVED_BUYER" | "RESOLVED_SELLER" | "CLOSED") => {
    if (!selectedDispute) return;
    if (!resolution.trim()) {
      alert("Please provide a resolution summary");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          status: resolutionType,
          resolution: resolution,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resolve dispute");
      }

      setReviewDialogOpen(false);
      setSelectedDispute(null);
      setResolution("");
      fetchDisputes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resolve dispute");
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartReview = async () => {
    if (!selectedDispute || selectedDispute.status !== "OPEN") return;

    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId: selectedDispute.id,
          status: "UNDER_REVIEW",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start review");
      }

      // Refresh dispute details
      const disputeResponse = await fetch(`/api/admin/disputes/${selectedDispute.id}`);
      if (disputeResponse.ok) {
        const disputeData = await disputeResponse.json();
        setSelectedDispute(disputeData.dispute);
      }
      fetchDisputes();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start review");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDispute || !newMessage.trim()) return;

    setSendingMessage(true);
    try {
      const response = await fetch(`/api/admin/disputes/${selectedDispute.id}/messages`, {
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
      const disputeResponse = await fetch(`/api/admin/disputes/${selectedDispute.id}`);
      if (disputeResponse.ok) {
        const disputeData = await disputeResponse.json();
        setSelectedDispute(disputeData.dispute);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  const openReviewDialog = async (dispute: Dispute) => {
    setSelectedDispute(dispute);
    setResolution("");
    setReviewDialogOpen(true);
    // Fetch full dispute details
    try {
      const response = await fetch(`/api/admin/disputes/${dispute.id}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedDispute(data.dispute);
      }
    } catch (err) {
      console.error("Failed to fetch dispute details:", err);
    }
  };

  const openCount = disputes.filter(d => d.status === "OPEN" || d.status === "UNDER_REVIEW").length;

  if (loading && disputes.length === 0) {
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
          <h1 className="text-3xl font-bold tracking-tight">Dispute Resolution</h1>
          <p className="text-muted-foreground">
            Review and resolve customer disputes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {openCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {openCount} active
            </Badge>
          )}
          <Button variant="outline" onClick={fetchDisputes}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => d.status === "OPEN").length}
                </p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => d.status === "UNDER_REVIEW").length}
                </p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => d.status.startsWith("RESOLVED")).length}
                </p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {disputes.filter(d => d.status === "CLOSED").length}
                </p>
                <p className="text-sm text-muted-foreground">Closed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user email or transaction ID..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchDisputes()}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
                <SelectItem value="RESOLVED_BUYER">Resolved - Buyer</SelectItem>
                <SelectItem value="RESOLVED_SELLER">Resolved - Seller</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Disputes List */}
      <div className="space-y-4">
        {disputes.length > 0 ? (
          disputes.map((dispute) => {
            const status = statusConfig[dispute.status] || statusConfig.OPEN;
            const StatusIcon = status.icon;

            return (
              <Card key={dispute.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => openReviewDialog(dispute)}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                        <AlertTriangle className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{reasonLabels[dispute.reason] || dispute.reason}</p>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Filed by: {dispute.user.displayName || dispute.user.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Transaction: {dispute.transaction.referenceId} • {formatCurrency(dispute.transaction.amount, dispute.transaction.currency)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatDate(dispute.createdAt)}
                      </p>
                      {dispute.messages.length > 0 && (
                        <div className="flex items-center justify-end gap-1 text-sm text-muted-foreground mt-1">
                          <MessageSquare className="h-3 w-3" />
                          {dispute.messages.length}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No disputes found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Dispute Review
                  <Badge className={statusConfig[selectedDispute.status]?.color || "bg-gray-100"}>
                    {statusConfig[selectedDispute.status]?.label || selectedDispute.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {reasonLabels[selectedDispute.reason] || selectedDispute.reason} - Filed {formatDate(selectedDispute.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="transaction">Transaction</TabsTrigger>
                  <TabsTrigger value="messages">Messages ({selectedDispute.messages.length})</TabsTrigger>
                  <TabsTrigger value="resolve">Resolve</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Reason</Label>
                      <p className="font-medium">{reasonLabels[selectedDispute.reason] || selectedDispute.reason}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={statusConfig[selectedDispute.status]?.color || "bg-gray-100"}>
                        {statusConfig[selectedDispute.status]?.label || selectedDispute.status}
                      </Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Filed By</Label>
                      <p className="font-medium">{selectedDispute.user.displayName || selectedDispute.user.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Filed On</Label>
                      <p className="font-medium">{formatDate(selectedDispute.createdAt)}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{selectedDispute.description}</p>
                  </div>
                  {selectedDispute.resolution && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <Label className="text-green-800">Resolution</Label>
                      <p className="text-sm text-green-700 mt-1">{selectedDispute.resolution}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="transaction" className="space-y-4 mt-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Reference ID</Label>
                        <p className="font-mono">{selectedDispute.transaction.referenceId}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Amount</Label>
                        <p className="font-bold text-lg">
                          {formatCurrency(selectedDispute.transaction.amount, selectedDispute.transaction.currency)}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Type</Label>
                        <p className="font-medium">{selectedDispute.transaction.type}</p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Status</Label>
                        <Badge variant="secondary">{selectedDispute.transaction.status}</Badge>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Date</Label>
                        <p className="font-medium">{formatDate(selectedDispute.transaction.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedDispute.transaction.sender && (
                      <div className="p-4 border rounded-lg">
                        <Label className="text-muted-foreground">Sender</Label>
                        <div className="flex items-center gap-3 mt-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {(selectedDispute.transaction.sender.displayName || selectedDispute.transaction.sender.email)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{selectedDispute.transaction.sender.displayName}</p>
                            <p className="text-sm text-muted-foreground">{selectedDispute.transaction.sender.email}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedDispute.transaction.recipient && (
                      <div className="p-4 border rounded-lg">
                        <Label className="text-muted-foreground">Recipient</Label>
                        <div className="flex items-center gap-3 mt-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {(selectedDispute.transaction.recipient.displayName || selectedDispute.transaction.recipient.email)[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{selectedDispute.transaction.recipient.displayName}</p>
                            <p className="text-sm text-muted-foreground">{selectedDispute.transaction.recipient.email}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="messages" className="mt-4">
                  <div className="space-y-3 max-h-80 overflow-y-auto mb-4">
                    {selectedDispute.messages.length > 0 ? (
                      selectedDispute.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.senderType === "ADMIN"
                              ? "bg-primary/10 ml-8"
                              : "bg-muted mr-8"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.senderType === "ADMIN" ? "Support" : msg.senderType === "USER" ? "User" : "System"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No messages yet
                      </p>
                    )}
                  </div>
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
                </TabsContent>

                <TabsContent value="resolve" className="space-y-4 mt-4">
                  {selectedDispute.status === "OPEN" && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Start the review process before resolving this dispute.
                      </AlertDescription>
                    </Alert>
                  )}

                  {(selectedDispute.status === "OPEN" || selectedDispute.status === "UNDER_REVIEW") && (
                    <>
                      <div>
                        <Label>Resolution Summary</Label>
                        <Textarea
                          placeholder="Describe the resolution outcome and any actions taken..."
                          value={resolution}
                          onChange={(e) => setResolution(e.target.value)}
                          className="mt-2"
                          rows={4}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {selectedDispute.status === "OPEN" && (
                          <Button
                            variant="outline"
                            onClick={handleStartReview}
                            disabled={actionLoading}
                            className="col-span-3"
                          >
                            {actionLoading ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="mr-2 h-4 w-4" />
                            )}
                            Start Review
                          </Button>
                        )}
                        {selectedDispute.status === "UNDER_REVIEW" && (
                          <>
                            <Button
                              onClick={() => handleResolve("RESOLVED_BUYER")}
                              disabled={actionLoading || !resolution.trim()}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {actionLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                              )}
                              Favor Buyer
                            </Button>
                            <Button
                              onClick={() => handleResolve("RESOLVED_SELLER")}
                              disabled={actionLoading || !resolution.trim()}
                              variant="outline"
                            >
                              {actionLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="mr-2 h-4 w-4" />
                              )}
                              Favor Seller
                            </Button>
                            <Button
                              onClick={() => handleResolve("CLOSED")}
                              disabled={actionLoading || !resolution.trim()}
                              variant="secondary"
                            >
                              {actionLoading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Close
                            </Button>
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {(selectedDispute.status.startsWith("RESOLVED") || selectedDispute.status === "CLOSED") && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                      <p className="font-medium">This dispute has been resolved</p>
                      {selectedDispute.resolution && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {selectedDispute.resolution}
                        </p>
                      )}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
