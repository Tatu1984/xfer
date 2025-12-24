"use client";

import { useState, useEffect } from "react";
import {
  UserCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Loader2,
  FileText,
  User,
  MapPin,
  Camera,
  Download,
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

interface KYCVerification {
  id: string;
  userId: string;
  type: string;
  status: string;
  documentType: string | null;
  documentNumber: string | null;
  documentFront: string | null;
  documentBack: string | null;
  selfieImage: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
  notes: string | null;
  reviewedAt: string | null;
  submittedAt: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
  };
}

interface KYCResponse {
  verifications: KYCVerification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

const typeConfig: Record<string, { label: string; icon: typeof User }> = {
  IDENTITY: { label: "Identity Document", icon: User },
  ADDRESS: { label: "Address Verification", icon: MapPin },
  SELFIE: { label: "Selfie Verification", icon: Camera },
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminKYCPage() {
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [typeFilter, setTypeFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [selectedVerification, setSelectedVerification] = useState<KYCVerification | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: "20",
        status: statusFilter,
      });
      if (typeFilter !== "all") params.append("type", typeFilter);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/admin/kyc?${params}`);
      if (!response.ok) throw new Error("Failed to fetch verifications");

      const data: KYCResponse = await response.json();
      setVerifications(data.verifications);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVerifications();
  }, [statusFilter, typeFilter, pagination.page]);

  const handleAction = async (action: "approve" | "reject") => {
    if (!selectedVerification) return;
    if (action === "reject" && !rejectionNotes.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verificationId: selectedVerification.id,
          action,
          notes: action === "reject" ? rejectionNotes : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update verification");
      }

      setReviewDialogOpen(false);
      setSelectedVerification(null);
      setRejectionNotes("");
      fetchVerifications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update verification");
    } finally {
      setActionLoading(false);
    }
  };

  const openReviewDialog = (verification: KYCVerification) => {
    setSelectedVerification(verification);
    setRejectionNotes("");
    setReviewDialogOpen(true);
  };

  const pendingCount = verifications.filter(v => v.status === "PENDING").length;

  if (loading && verifications.length === 0) {
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
          <h1 className="text-3xl font-bold tracking-tight">KYC Review</h1>
          <p className="text-muted-foreground">
            Review and verify user identity documents
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {pendingCount} pending
            </Badge>
          )}
          <Button variant="outline" onClick={fetchVerifications}>
            <Loader2 className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
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

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email or name..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchVerifications()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="IDENTITY">Identity</SelectItem>
                  <SelectItem value="ADDRESS">Address</SelectItem>
                  <SelectItem value="SELFIE">Selfie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verifications List */}
      <div className="space-y-4">
        {verifications.length > 0 ? (
          verifications.map((verification) => {
            const status = statusConfig[verification.status] || statusConfig.PENDING;
            const type = typeConfig[verification.type] || { label: verification.type, icon: FileText };
            const StatusIcon = status.icon;
            const TypeIcon = type.icon;
            const userName = verification.user.displayName ||
              `${verification.user.firstName || ""} ${verification.user.lastName || ""}`.trim() ||
              "Unknown";
            const initials = userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

            return (
              <Card key={verification.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>{initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold">{userName}</p>
                          <Badge className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {verification.user.email}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{type.label}</span>
                          </div>
                          {verification.documentType && (
                            <span className="text-muted-foreground">
                              {verification.documentType.replace("_", " ")}
                            </span>
                          )}
                          {verification.country && (
                            <span className="text-muted-foreground">
                              {verification.country}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-muted-foreground mr-4">
                        {formatDate(verification.submittedAt)}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(verification)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                      {verification.status === "PENDING" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVerification(verification);
                              handleAction("reject");
                            }}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedVerification(verification);
                              handleAction("approve");
                            }}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        </>
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
              <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No verifications found</p>
              <p className="text-sm">
                {statusFilter === "PENDING"
                  ? "All caught up! No pending verifications."
                  : "Try adjusting your filters."}
              </p>
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
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          {selectedVerification && (
            <>
              <DialogHeader>
                <DialogTitle>Review KYC Verification</DialogTitle>
                <DialogDescription>
                  {typeConfig[selectedVerification.type]?.label || selectedVerification.type} submitted by {selectedVerification.user.displayName || selectedVerification.user.email}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details" className="mt-4">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="user">User Info</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Type</Label>
                      <p className="font-medium">{typeConfig[selectedVerification.type]?.label || selectedVerification.type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={statusConfig[selectedVerification.status]?.color || "bg-gray-100"}>
                        {statusConfig[selectedVerification.status]?.label || selectedVerification.status}
                      </Badge>
                    </div>
                    {selectedVerification.documentType && (
                      <div>
                        <Label className="text-muted-foreground">Document Type</Label>
                        <p className="font-medium">{selectedVerification.documentType.replace("_", " ")}</p>
                      </div>
                    )}
                    {selectedVerification.documentNumber && (
                      <div>
                        <Label className="text-muted-foreground">Document Number</Label>
                        <p className="font-medium">{selectedVerification.documentNumber}</p>
                      </div>
                    )}
                    {selectedVerification.addressLine1 && (
                      <div className="col-span-2">
                        <Label className="text-muted-foreground">Address</Label>
                        <p className="font-medium">
                          {selectedVerification.addressLine1}
                          {selectedVerification.city && `, ${selectedVerification.city}`}
                          {selectedVerification.state && `, ${selectedVerification.state}`}
                          {selectedVerification.postalCode && ` ${selectedVerification.postalCode}`}
                          {selectedVerification.country && `, ${selectedVerification.country}`}
                        </p>
                      </div>
                    )}
                    <div>
                      <Label className="text-muted-foreground">Submitted</Label>
                      <p className="font-medium">{formatDate(selectedVerification.submittedAt)}</p>
                    </div>
                    {selectedVerification.reviewedAt && (
                      <div>
                        <Label className="text-muted-foreground">Reviewed</Label>
                        <p className="font-medium">{formatDate(selectedVerification.reviewedAt)}</p>
                      </div>
                    )}
                  </div>
                  {selectedVerification.notes && (
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{selectedVerification.notes}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents" className="space-y-4 mt-4">
                  <div className="grid gap-4">
                    {selectedVerification.documentFront && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">Document Front</Label>
                        <div className="border rounded-lg p-4 bg-muted/50 text-center">
                          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Document uploaded</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedVerification.documentBack && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">Document Back</Label>
                        <div className="border rounded-lg p-4 bg-muted/50 text-center">
                          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Document uploaded</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    {selectedVerification.selfieImage && (
                      <div>
                        <Label className="text-muted-foreground mb-2 block">Selfie</Label>
                        <div className="border rounded-lg p-4 bg-muted/50 text-center">
                          <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">Selfie uploaded</p>
                          <Button variant="outline" size="sm" className="mt-2">
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    {!selectedVerification.documentFront && !selectedVerification.documentBack && !selectedVerification.selfieImage && (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No documents uploaded</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="user" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Name</Label>
                      <p className="font-medium">
                        {selectedVerification.user.displayName ||
                          `${selectedVerification.user.firstName || ""} ${selectedVerification.user.lastName || ""}`.trim() ||
                          "Not provided"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <p className="font-medium">{selectedVerification.user.email}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">User ID</Label>
                      <p className="font-mono text-sm">{selectedVerification.user.id}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Account Created</Label>
                      <p className="font-medium">{formatDate(selectedVerification.user.createdAt)}</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {selectedVerification.status === "PENDING" && (
                <div className="space-y-4 mt-6 pt-6 border-t">
                  <div>
                    <Label>Rejection Notes (required if rejecting)</Label>
                    <Textarea
                      placeholder="Provide a reason for rejection..."
                      value={rejectionNotes}
                      onChange={(e) => setRejectionNotes(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setReviewDialogOpen(false)}
                      disabled={actionLoading}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleAction("reject")}
                      disabled={actionLoading || !rejectionNotes.trim()}
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleAction("approve")}
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Approve
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
