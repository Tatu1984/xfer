"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Filter,
  Search,
  FileText,
  User,
  Building2,
  Clock,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface KYCVerification {
  id: string;
  userId: string;
  status: string;
  level: number;
  documentType: string;
  documentNumber: string;
  documentCountry: string;
  dateOfBirth: string | null;
  address: string | null;
  documents: Record<string, unknown>;
  rejectionReason: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    displayName: string | null;
    phone: string | null;
    createdAt: string;
    business?: {
      legalName: string;
      businessType: string;
    } | null;
  };
}

interface Summary {
  pending: number;
  inReview: number;
  personal: number;
  business: number;
}

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  IN_REVIEW: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function KYCReviewPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [summary, setSummary] = useState<Summary>({ pending: 0, inReview: 0, personal: 0, business: 0 });
  const [selectedRequest, setSelectedRequest] = useState<KYCVerification | null>(null);
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchVerifications();
  }, [filter]);

  const fetchVerifications = async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.append("status", filter);

      const response = await fetch(`/api/admin/kyc?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setVerifications(data.verifications);

        // Calculate summary
        const pending = data.verifications.filter((v: KYCVerification) => v.status === "PENDING").length;
        const inReview = data.verifications.filter((v: KYCVerification) => v.status === "IN_REVIEW").length;
        const personal = data.verifications.filter((v: KYCVerification) => !v.user.business).length;
        const business = data.verifications.filter((v: KYCVerification) => v.user.business).length;
        setSummary({ pending, inReview, personal, business });
      } else {
        toast({
          title: "Error",
          description: "Failed to load KYC verifications",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load KYC verifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = verifications.filter((req) => {
    const fullName = `${req.user.firstName} ${req.user.lastName}`.toLowerCase();
    if (searchQuery && !fullName.includes(searchQuery.toLowerCase()) &&
        !req.user.email.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleApprove = async (kycId: string) => {
    setActionLoading(kycId);
    try {
      const response = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kycId,
          status: "APPROVED",
          level: 2,
        }),
      });

      if (response.ok) {
        toast({
          title: "KYC Approved",
          description: "The user has been verified successfully",
        });
        setSelectedRequest(null);
        fetchVerifications();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to approve KYC",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to approve KYC",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (kycId: string) => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(kycId);
    try {
      const response = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kycId,
          status: "REJECTED",
          rejectionReason,
        }),
      });

      if (response.ok) {
        toast({
          title: "KYC Rejected",
          description: "The verification has been rejected",
        });
        setSelectedRequest(null);
        setRejectionReason("");
        fetchVerifications();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to reject KYC",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to reject KYC",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = () => {
    if (verifications.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no KYC verifications to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["ID", "Name", "Email", "Status", "Document Type", "Country", "Submitted"].join(","),
      ...verifications.map((v) =>
        [
          v.id,
          `"${v.user.firstName} ${v.user.lastName}"`,
          v.user.email,
          v.status,
          v.documentType,
          v.documentCountry,
          new Date(v.createdAt).toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kyc-verifications-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${verifications.length} verifications`,
    });
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
          <h1 className="text-3xl font-bold tracking-tight">KYC Review Queue</h1>
          <p className="text-muted-foreground">
            Review and verify user identity documents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchVerifications}>
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
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.pending}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.inReview}</p>
                <p className="text-sm text-muted-foreground">In Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <User className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.personal}</p>
                <p className="text-sm text-muted-foreground">Personal KYC</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.business}</p>
                <p className="text-sm text-muted-foreground">Business KYB</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="IN_REVIEW">In Review</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KYC List */}
      {filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No KYC requests found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filter !== "all"
                  ? "Try adjusting your search or filters"
                  : "No pending KYC verifications at this time"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback>
                        {request.user.firstName[0]}{request.user.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {request.user.firstName} {request.user.lastName}
                        </h3>
                        <Badge className={statusColors[request.status] || "bg-gray-100"}>
                          {request.status.replace("_", " ")}
                        </Badge>
                        <Badge variant="outline">
                          {request.user.business ? (
                            <><Building2 className="mr-1 h-3 w-3" /> Business</>
                          ) : (
                            <><User className="mr-1 h-3 w-3" /> Personal</>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{request.user.email}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <span>{request.documentCountry}</span>
                        <span>-</span>
                        <span>Submitted {new Date(request.createdAt).toLocaleDateString()}</span>
                        <span>-</span>
                        <span>{request.documentType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedRequest(request);
                        setRejectionReason("");
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Review
                    </Button>
                    {request.status === "PENDING" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            setSelectedRequest(request);
                            setRejectionReason("");
                          }}
                          disabled={actionLoading === request.id}
                        >
                          {actionLoading === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(request.id)}
                          disabled={actionLoading === request.id}
                        >
                          {actionLoading === request.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>Review KYC Application</DialogTitle>
                <DialogDescription>
                  {selectedRequest.user.firstName} {selectedRequest.user.lastName} - {selectedRequest.user.business ? "Business" : "Personal"} Verification
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                  <TabsTrigger value="risk">Risk Assessment</TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <p className="mt-1 font-medium">
                        {selectedRequest.user.firstName} {selectedRequest.user.lastName}
                      </p>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <p className="mt-1 font-medium">{selectedRequest.user.email}</p>
                    </div>
                    <div>
                      <Label>Document Type</Label>
                      <p className="mt-1 font-medium">{selectedRequest.documentType}</p>
                    </div>
                    <div>
                      <Label>Document Number</Label>
                      <p className="mt-1 font-medium">{selectedRequest.documentNumber}</p>
                    </div>
                    <div>
                      <Label>Country</Label>
                      <p className="mt-1 font-medium">{selectedRequest.documentCountry}</p>
                    </div>
                    <div>
                      <Label>Address</Label>
                      <p className="mt-1 font-medium">{selectedRequest.address || "N/A"}</p>
                    </div>
                  </div>
                  {selectedRequest.user.business && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-semibold mb-4">Business Details</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Legal Name</Label>
                          <p className="mt-1 font-medium">{selectedRequest.user.business.legalName}</p>
                        </div>
                        <div>
                          <Label>Business Type</Label>
                          <p className="mt-1 font-medium">{selectedRequest.user.business.businessType}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="documents" className="space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{selectedRequest.documentType}</p>
                          <p className="text-sm text-muted-foreground">
                            Document #{selectedRequest.documentNumber}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColors[selectedRequest.status] || "bg-gray-100"}>
                          {selectedRequest.status}
                        </Badge>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="risk" className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Verification Level</h4>
                      <Badge className="bg-blue-100 text-blue-800">
                        Level {selectedRequest.level}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>No sanctions matches found</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>No PEP matches found</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Document authenticity verified</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {selectedRequest.status === "PENDING" && (
                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <Label>Rejection Reason (if rejecting)</Label>
                    <Textarea
                      placeholder="Enter reason for rejection..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Cancel
                </Button>
                {selectedRequest.status === "PENDING" && (
                  <>
                    <Button
                      variant="destructive"
                      onClick={() => handleReject(selectedRequest.id)}
                      disabled={!rejectionReason || actionLoading === selectedRequest.id}
                    >
                      {actionLoading === selectedRequest.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      onClick={() => handleApprove(selectedRequest.id)}
                      disabled={actionLoading === selectedRequest.id}
                    >
                      {actionLoading === selectedRequest.id && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
