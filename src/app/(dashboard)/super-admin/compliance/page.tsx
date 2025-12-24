"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Shield,
  Eye,
  CheckCircle,
  XCircle,
  User,
  Filter,
  Download,
  Clock,
  Flag,
  Loader2,
  RefreshCw,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface ComplianceAlert {
  id: string;
  type: string;
  description: string;
  severity: string;
  status: string;
  notes?: string;
  createdAt: string;
  reviewedAt?: string;
  resolvedAt?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  transaction?: {
    id: string;
    type: string;
    amount: number;
    status: string;
  };
}

interface Summary {
  pending: number;
  reviewing: number;
  resolved: number;
  highSeverity: number;
}

const alertTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  SANCTIONS_MATCH: { label: "Sanctions Match", icon: Shield, color: "bg-red-100 text-red-800" },
  PEP_MATCH: { label: "PEP Match", icon: User, color: "bg-purple-100 text-purple-800" },
  SUSPICIOUS_ACTIVITY: { label: "Suspicious Activity", icon: AlertTriangle, color: "bg-orange-100 text-orange-800" },
  HIGH_RISK_COUNTRY: { label: "High-Risk Country", icon: Flag, color: "bg-yellow-100 text-yellow-800" },
  VELOCITY_BREACH: { label: "Velocity Breach", icon: Clock, color: "bg-blue-100 text-blue-800" },
  LARGE_TRANSACTION: { label: "Large Transaction", icon: AlertTriangle, color: "bg-orange-100 text-orange-800" },
};

const severityConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: "Low", color: "bg-green-100 text-green-800" },
  MEDIUM: { label: "Medium", color: "bg-yellow-100 text-yellow-800" },
  HIGH: { label: "High", color: "bg-orange-100 text-orange-800" },
  CRITICAL: { label: "Critical", color: "bg-red-100 text-red-800" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  REVIEWING: { label: "Reviewing", color: "bg-blue-100 text-blue-800" },
  ESCALATED: { label: "Escalated", color: "bg-orange-100 text-orange-800" },
  RESOLVED: { label: "Resolved", color: "bg-green-100 text-green-800" },
  DISMISSED: { label: "Dismissed", color: "bg-gray-100 text-gray-800" },
};

export default function CompliancePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedAlert, setSelectedAlert] = useState<ComplianceAlert | null>(null);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchAlerts();
  }, [statusFilter, severityFilter]);

  const fetchAlerts = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (severityFilter !== "all") params.append("severity", severityFilter);

      const response = await fetch(`/api/admin/compliance?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data.alerts);
        setSummary(data.summary);
      } else {
        toast({
          title: "Error",
          description: "Failed to load compliance alerts",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load compliance alerts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (alertId: string, action: string) => {
    setActionLoading(alertId);
    try {
      const response = await fetch("/api/admin/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: alertId,
          action,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Alert ${action === "review" ? "marked as reviewing" : action === "resolve" ? "resolved" : action === "escalate" ? "escalated" : "dismissed"}`,
        });
        setSelectedAlert(null);
        setNotes("");
        fetchAlerts();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to update alert",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to update alert",
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleExport = () => {
    if (alerts.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no alerts to export",
        variant: "destructive",
      });
      return;
    }

    const csvContent = [
      ["ID", "Type", "Severity", "Status", "User", "Description", "Created"].join(","),
      ...alerts.map((a) =>
        [
          a.id,
          a.type,
          a.severity,
          a.status,
          a.user ? `"${a.user.firstName} ${a.user.lastName}"` : "N/A",
          `"${a.description}"`,
          new Date(a.createdAt).toISOString(),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compliance-alerts-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: `Exported ${alerts.length} alerts`,
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
          <h1 className="text-3xl font-bold tracking-tight">Compliance Alerts</h1>
          <p className="text-muted-foreground">
            Monitor and investigate compliance issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchAlerts}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{summary.highSeverity}</p>
                  <p className="text-sm text-muted-foreground">High Severity</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{summary.pending}</p>
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
                  <p className="text-2xl font-bold">{summary.reviewing}</p>
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
                  <p className="text-2xl font-bold">{summary.resolved}</p>
                  <p className="text-sm text-muted-foreground">Resolved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewing">Reviewing</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== "all" || severityFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all");
              setSeverityFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {/* Alerts List */}
      {alerts.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <div className="text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold">No alerts found</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all" || severityFilter !== "all"
                  ? "Try adjusting your filters"
                  : "All compliance alerts have been addressed"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => {
            const typeConfig = alertTypeConfig[alert.type] || { label: alert.type, icon: AlertTriangle, color: "bg-gray-100 text-gray-800" };
            const TypeIcon = typeConfig.icon;
            const sevConfig = severityConfig[alert.severity] || { label: alert.severity, color: "bg-gray-100" };
            const statConfig = statusConfig[alert.status] || { label: alert.status, color: "bg-gray-100" };

            return (
              <Card
                key={alert.id}
                className={`hover:shadow-md transition-shadow ${
                  alert.severity === "CRITICAL" ? "border-red-200" :
                  alert.severity === "HIGH" ? "border-orange-200" : ""
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        alert.severity === "CRITICAL" ? "bg-red-100" :
                        alert.severity === "HIGH" ? "bg-orange-100" :
                        alert.severity === "MEDIUM" ? "bg-yellow-100" :
                        "bg-green-100"
                      }`}>
                        <TypeIcon className={`h-6 w-6 ${
                          alert.severity === "CRITICAL" ? "text-red-600" :
                          alert.severity === "HIGH" ? "text-orange-600" :
                          alert.severity === "MEDIUM" ? "text-yellow-600" :
                          "text-green-600"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{typeConfig.label}</h3>
                          <Badge className={sevConfig.color}>
                            {sevConfig.label}
                          </Badge>
                          <Badge className={statConfig.color}>
                            {statConfig.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {alert.description}
                        </p>
                        <div className="flex items-center gap-4 text-sm">
                          {alert.user && (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {alert.user.firstName[0]}{alert.user.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span>{alert.user.firstName} {alert.user.lastName}</span>
                            </div>
                          )}
                          <span className="text-muted-foreground">
                            {new Date(alert.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {actionLoading === alert.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAlert(alert);
                              setNotes("");
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Review
                          </Button>
                          {alert.status === "PENDING" && (
                            <Button
                              size="sm"
                              onClick={() => handleAction(alert.id, "review")}
                            >
                              Start Review
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <DialogContent className="max-w-2xl">
          {selectedAlert && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {alertTypeConfig[selectedAlert.type]?.label || selectedAlert.type}
                </DialogTitle>
                <DialogDescription>
                  Alert ID: {selectedAlert.id.slice(0, 8)}...
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {selectedAlert.user && (
                    <div>
                      <Label className="text-sm text-muted-foreground">User</Label>
                      <p className="font-medium">
                        {selectedAlert.user.firstName} {selectedAlert.user.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{selectedAlert.user.email}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm text-muted-foreground">Severity</Label>
                    <Badge className={severityConfig[selectedAlert.severity]?.color || "bg-gray-100"}>
                      {severityConfig[selectedAlert.severity]?.label || selectedAlert.severity}
                    </Badge>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="mt-1">{selectedAlert.description}</p>
                </div>

                {selectedAlert.transaction && (
                  <div className="p-4 bg-muted rounded-lg">
                    <Label className="text-sm text-muted-foreground mb-2 block">Related Transaction</Label>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Type: {selectedAlert.transaction.type}</div>
                      <div>Amount: ${selectedAlert.transaction.amount.toFixed(2)}</div>
                      <div>Status: {selectedAlert.transaction.status}</div>
                    </div>
                  </div>
                )}

                {(selectedAlert.status === "PENDING" || selectedAlert.status === "REVIEWING") && (
                  <div>
                    <Label htmlFor="notes">Resolution Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Enter your investigation findings and resolution..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSelectedAlert(null)}>
                  Cancel
                </Button>
                {(selectedAlert.status === "PENDING" || selectedAlert.status === "REVIEWING") && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={() => handleAction(selectedAlert.id, "dismiss")}
                      disabled={actionLoading === selectedAlert.id || !notes.trim()}
                    >
                      {actionLoading === selectedAlert.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <XCircle className="mr-2 h-4 w-4" />
                      Dismiss
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleAction(selectedAlert.id, "escalate")}
                      disabled={actionLoading === selectedAlert.id}
                    >
                      {actionLoading === selectedAlert.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <ArrowUpCircle className="mr-2 h-4 w-4" />
                      Escalate
                    </Button>
                    <Button
                      onClick={() => handleAction(selectedAlert.id, "resolve")}
                      disabled={actionLoading === selectedAlert.id}
                    >
                      {actionLoading === selectedAlert.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Resolve
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
