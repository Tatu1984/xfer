"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, CheckCircle, Eye, Clock, Loader2, MoreHorizontal, ArrowUpCircle, XCircle, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Alert {
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

export default function AdminCompliancePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");

  // Action dialog state
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("");
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

  const openActionDialog = (alert: Alert, action: string) => {
    setSelectedAlert(alert);
    setSelectedAction(action);
    setNotes("");
    setActionDialogOpen(true);
  };

  const handleQuickAction = async (alertId: string, action: string) => {
    setActionLoading(alertId);
    try {
      const response = await fetch("/api/admin/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: alertId, action }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Alert ${action === "review" ? "marked as reviewing" : action + "d"} successfully`,
        });
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

  const handleActionWithNotes = async () => {
    if (!selectedAlert || !selectedAction) return;

    setActionLoading(selectedAlert.id);
    try {
      const response = await fetch("/api/admin/compliance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedAlert.id,
          action: selectedAction,
          notes: notes || undefined,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Alert ${selectedAction === "review" ? "marked as reviewing" : selectedAction + "d"} successfully`,
        });
        setActionDialogOpen(false);
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

  const getActionTitle = () => {
    switch (selectedAction) {
      case "resolve": return "Resolve Alert";
      case "escalate": return "Escalate Alert";
      case "dismiss": return "Dismiss Alert";
      default: return "Update Alert";
    }
  };

  const getActionDescription = () => {
    switch (selectedAction) {
      case "resolve": return "Mark this alert as resolved. Add notes to document the resolution.";
      case "escalate": return "Escalate this alert to critical severity. Add notes explaining the reason.";
      case "dismiss": return "Dismiss this alert as a false positive. Add notes explaining why.";
      default: return "Update this alert status.";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
          <h1 className="text-3xl font-bold">Compliance Alerts</h1>
          <p className="text-muted-foreground">
            Review and manage compliance alerts
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchAlerts()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">In Review</CardTitle>
              <Eye className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.reviewing}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.resolved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">High Severity</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.highSeverity}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Compliance Alerts</CardTitle>
              <CardDescription>Alerts requiring review</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-10">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <h3 className="mt-4 text-lg font-semibold">No alerts found</h3>
              <p className="text-muted-foreground">
                {statusFilter !== "all" || severityFilter !== "all"
                  ? "No alerts match your filters"
                  : "All compliance alerts have been addressed"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alert</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <div>
                        <div className="font-mono text-sm">{alert.id.slice(0, 8)}...</div>
                        <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {alert.description}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {alert.user ? (
                        <div>
                          <div className="font-medium">
                            {alert.user.firstName} {alert.user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {alert.user.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {alert.transaction ? (
                        <div>
                          <div className="font-medium">
                            {formatCurrency(alert.transaction.amount)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {alert.transaction.type}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          alert.severity === "CRITICAL"
                            ? "destructive"
                            : alert.severity === "HIGH"
                            ? "destructive"
                            : alert.severity === "MEDIUM"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          alert.status === "RESOLVED"
                            ? "default"
                            : alert.status === "REVIEWING"
                            ? "secondary"
                            : alert.status === "ESCALATED"
                            ? "destructive"
                            : alert.status === "DISMISSED"
                            ? "outline"
                            : "outline"
                        }
                      >
                        {alert.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {actionLoading === alert.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {alert.status === "PENDING" && (
                              <DropdownMenuItem onClick={() => handleQuickAction(alert.id, "review")}>
                                <Eye className="mr-2 h-4 w-4" />
                                Start Review
                              </DropdownMenuItem>
                            )}
                            {(alert.status === "PENDING" || alert.status === "REVIEWING") && (
                              <>
                                <DropdownMenuItem onClick={() => openActionDialog(alert, "resolve")}>
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Resolve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openActionDialog(alert, "escalate")}>
                                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                                  Escalate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => openActionDialog(alert, "dismiss")}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Dismiss
                                </DropdownMenuItem>
                              </>
                            )}
                            {(alert.status === "RESOLVED" || alert.status === "DISMISSED" || alert.status === "ESCALATED") && (
                              <DropdownMenuItem disabled>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                No actions available
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{getActionTitle()}</DialogTitle>
            <DialogDescription>{getActionDescription()}</DialogDescription>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Alert ID:</span>
                  <span className="font-mono text-sm">{selectedAlert.id.slice(0, 12)}...</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Type:</span>
                  <Badge variant="outline">{selectedAlert.type}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Severity:</span>
                  <Badge variant={selectedAlert.severity === "HIGH" ? "destructive" : "secondary"}>
                    {selectedAlert.severity}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes {selectedAction === "dismiss" && "(required)"}</Label>
                <Textarea
                  id="notes"
                  placeholder={
                    selectedAction === "resolve"
                      ? "Describe how the alert was resolved..."
                      : selectedAction === "escalate"
                      ? "Explain the reason for escalation..."
                      : "Explain why this alert is being dismissed..."
                  }
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleActionWithNotes}
              disabled={actionLoading !== null || (selectedAction === "dismiss" && !notes.trim())}
              variant={selectedAction === "escalate" ? "destructive" : "default"}
            >
              {actionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedAction === "resolve" && "Resolve Alert"}
              {selectedAction === "escalate" && "Escalate Alert"}
              {selectedAction === "dismiss" && "Dismiss Alert"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
