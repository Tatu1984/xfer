"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Download,
  Filter,
  Eye,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Dispute {
  id: string;
  type: string;
  reason: string;
  status: string;
  amount: number;
  currency: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  createdBy?: {
    id: string;
    email: string;
    displayName?: string;
  };
  respondent?: {
    id: string;
    email: string;
    displayName?: string;
  };
  transaction?: {
    id: string;
    referenceId: string;
    amount: number;
    currency: string;
  };
  messages?: Array<{
    id: string;
    message: string;
    senderRole: string;
    createdAt: string;
  }>;
}

interface Summary {
  open: number;
  underReview: number;
  escalated: number;
  resolved: number;
}

const typeConfig: Record<string, { label: string; color: string }> = {
  ITEM_NOT_RECEIVED: { label: "Item Not Received", color: "bg-orange-100 text-orange-800" },
  NOT_AS_DESCRIBED: { label: "Not As Described", color: "bg-purple-100 text-purple-800" },
  UNAUTHORIZED: { label: "Unauthorized", color: "bg-red-100 text-red-800" },
  DUPLICATE: { label: "Duplicate", color: "bg-blue-100 text-blue-800" },
  OTHER: { label: "Other", color: "bg-gray-100 text-gray-800" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  OPEN: { label: "Open", color: "bg-yellow-100 text-yellow-800" },
  UNDER_REVIEW: { label: "Under Review", color: "bg-blue-100 text-blue-800" },
  WAITING_SELLER: { label: "Waiting Seller", color: "bg-purple-100 text-purple-800" },
  WAITING_BUYER: { label: "Waiting Buyer", color: "bg-indigo-100 text-indigo-800" },
  ESCALATED: { label: "Escalated", color: "bg-red-100 text-red-800" },
  RESOLVED_BUYER_FAVOR: { label: "Resolved (Buyer)", color: "bg-green-100 text-green-800" },
  RESOLVED_SELLER_FAVOR: { label: "Resolved (Seller)", color: "bg-green-100 text-green-800" },
  CLOSED: { label: "Closed", color: "bg-gray-100 text-gray-800" },
};

export default function DisputesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [summary, setSummary] = useState<Summary>({ open: 0, underReview: 0, escalated: 0, resolved: 0 });
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Dialog state
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState("");
  const [dialogAction, setDialogAction] = useState<string | null>(null);

  useEffect(() => {
    fetchDisputes();
  }, [statusFilter]);

  const fetchDisputes = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (search) params.append("search", search);

      const response = await fetch(`/api/admin/disputes?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setDisputes(data.disputes);

        // Calculate summary
        const open = data.disputes.filter((d: Dispute) => d.status === "OPEN").length;
        const underReview = data.disputes.filter((d: Dispute) => d.status === "UNDER_REVIEW").length;
        const escalated = data.disputes.filter((d: Dispute) => d.status === "ESCALATED").length;
        const resolved = data.disputes.filter((d: Dispute) =>
          ["RESOLVED_BUYER_FAVOR", "RESOLVED_SELLER_FAVOR", "CLOSED"].includes(d.status)
        ).length;
        setSummary({ open, underReview, escalated, resolved });
      } else {
        toast({
          title: "Error",
          description: "Failed to load disputes",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load disputes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (disputeId: string, favor: "buyer" | "seller") => {
    setActionLoading(disputeId);
    try {
      const response = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          status: favor === "buyer" ? "RESOLVED_BUYER_FAVOR" : "RESOLVED_SELLER_FAVOR",
          resolution: resolution || `Resolved in ${favor}'s favor`,
        }),
      });

      if (response.ok) {
        toast({
          title: "Dispute resolved",
          description: `Dispute resolved in ${favor}'s favor`,
        });
        setSelectedDispute(null);
        setResolution("");
        setDialogAction(null);
        fetchDisputes();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to resolve dispute",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to resolve dispute",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartReview = async (disputeId: string) => {
    setActionLoading(disputeId);
    try {
      const response = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disputeId,
          status: "UNDER_REVIEW",
        }),
      });

      if (response.ok) {
        toast({
          title: "Review started",
          description: "Dispute is now under review",
        });
        fetchDisputes();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to start review",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to start review",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = () => {
    if (disputes.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no disputes to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["ID", "Type", "Status", "Amount", "Buyer", "Seller", "Reason", "Created"].join(","),
      ...disputes.map((d) =>
        [
          d.id,
          d.type,
          d.status,
          `${d.amount} ${d.currency}`,
          d.createdBy?.email || "N/A",
          d.respondent?.email || "N/A",
          `"${d.reason}"`,
          new Date(d.createdAt).toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disputes-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${disputes.length} disputes`,
    });
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const openResolveDialog = (dispute: Dispute, action: string) => {
    setSelectedDispute(dispute);
    setDialogAction(action);
    setResolution("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Disputes</h1>
          <p className="text-muted-foreground">
            Manage and resolve payment disputes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchDisputes}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.open}</p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.underReview}</p>
                <p className="text-sm text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.escalated}</p>
                <p className="text-sm text-muted-foreground">Escalated</p>
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
                <p className="text-2xl font-bold">{summary.resolved}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Search by email or transaction..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchDisputes()}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="UNDER_REVIEW">Under Review</SelectItem>
            <SelectItem value="ESCALATED">Escalated</SelectItem>
            <SelectItem value="RESOLVED_BUYER_FAVOR">Resolved (Buyer)</SelectItem>
            <SelectItem value="RESOLVED_SELLER_FAVOR">Resolved (Seller)</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || search) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Disputes Table */}
      {disputes.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold">No disputes found</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all" || search
                  ? "Try adjusting your filters"
                  : "No disputes have been filed"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((dispute) => {
                  const tConfig = typeConfig[dispute.type] || { label: dispute.type, color: "bg-gray-100" };
                  const sConfig = statusConfig[dispute.status] || { label: dispute.status, color: "bg-gray-100" };

                  return (
                    <TableRow key={dispute.id}>
                      <TableCell>
                        <div>
                          <p className="font-mono text-sm">{dispute.id.slice(0, 8)}...</p>
                          {dispute.transaction && (
                            <p className="text-xs text-muted-foreground">
                              {dispute.transaction.referenceId}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={tConfig.color}>
                          {tConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {dispute.createdBy ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {dispute.createdBy.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{dispute.createdBy.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {dispute.respondent ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {dispute.respondent.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{dispute.respondent.email}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(dispute.amount, dispute.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={sConfig.color}>
                          {sConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(dispute.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {actionLoading === dispute.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openResolveDialog(dispute, "view")}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {dispute.messages && dispute.messages.length > 0 && (
                                <DropdownMenuItem onClick={() => openResolveDialog(dispute, "messages")}>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  View Messages ({dispute.messages.length})
                                </DropdownMenuItem>
                              )}
                              {dispute.status === "OPEN" && (
                                <DropdownMenuItem onClick={() => handleStartReview(dispute.id)}>
                                  <Clock className="mr-2 h-4 w-4" />
                                  Start Review
                                </DropdownMenuItem>
                              )}
                              {!["RESOLVED_BUYER_FAVOR", "RESOLVED_SELLER_FAVOR", "CLOSED"].includes(dispute.status) && (
                                <>
                                  <DropdownMenuItem onClick={() => openResolveDialog(dispute, "buyer")}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Resolve - Buyer Wins
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openResolveDialog(dispute, "seller")}>
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Resolve - Seller Wins
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Dispute Details Dialog */}
      <Dialog open={!!selectedDispute && dialogAction === "view"} onOpenChange={() => setSelectedDispute(null)}>
        <DialogContent className="max-w-2xl">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle>Dispute Details</DialogTitle>
                <DialogDescription>
                  {selectedDispute.id}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <Badge className={typeConfig[selectedDispute.type]?.color || "bg-gray-100"}>
                      {typeConfig[selectedDispute.type]?.label || selectedDispute.type}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <Badge className={statusConfig[selectedDispute.status]?.color || "bg-gray-100"}>
                      {statusConfig[selectedDispute.status]?.label || selectedDispute.status}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Amount</Label>
                    <p className="font-medium">{formatCurrency(selectedDispute.amount, selectedDispute.currency)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p>{new Date(selectedDispute.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reason</Label>
                  <p className="mt-1">{selectedDispute.reason}</p>
                </div>
                {selectedDispute.resolution && (
                  <div>
                    <Label className="text-muted-foreground">Resolution</Label>
                    <p className="mt-1">{selectedDispute.resolution}</p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedDispute(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Messages Dialog */}
      <Dialog open={!!selectedDispute && dialogAction === "messages"} onOpenChange={() => setSelectedDispute(null)}>
        <DialogContent className="max-w-2xl">
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle>Dispute Messages</DialogTitle>
                <DialogDescription>
                  Communication history for this dispute
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {selectedDispute.messages?.map((msg) => (
                  <div key={msg.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{msg.senderRole}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{msg.message}</p>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedDispute(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog
        open={!!selectedDispute && (dialogAction === "buyer" || dialogAction === "seller")}
        onOpenChange={() => {
          setSelectedDispute(null);
          setDialogAction(null);
        }}
      >
        <DialogContent>
          {selectedDispute && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Resolve in {dialogAction === "buyer" ? "Buyer" : "Seller"}&apos;s Favor
                </DialogTitle>
                <DialogDescription>
                  This will close the dispute and {dialogAction === "buyer" ? "issue a refund to the buyer" : "release funds to the seller"}.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Dispute:</span>
                    <span className="font-mono">{selectedDispute.id.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium">{formatCurrency(selectedDispute.amount, selectedDispute.currency)}</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="resolution">Resolution Notes</Label>
                  <Textarea
                    id="resolution"
                    placeholder="Enter resolution details..."
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setSelectedDispute(null);
                  setDialogAction(null);
                }}>
                  Cancel
                </Button>
                <Button
                  onClick={() => handleResolve(selectedDispute.id, dialogAction as "buyer" | "seller")}
                  disabled={actionLoading === selectedDispute.id}
                >
                  {actionLoading === selectedDispute.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Resolution
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
