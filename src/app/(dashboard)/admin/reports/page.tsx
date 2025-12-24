"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { FileText, Download, Calendar, BarChart3, Users, Shield, DollarSign, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Report {
  id: string;
  name: string;
  description: string;
  type: string;
  status: string;
  generatedAt: string;
  size?: string;
  data?: Record<string, unknown>;
}

interface ReportSummary {
  totalTransactions: number;
  transactionVolume: number;
  totalUsers: number;
  newUsers: number;
  activeUsers: number;
}

const reportTypes = [
  { value: "TRANSACTION", label: "Transaction Report", icon: BarChart3, description: "All transactions with filters" },
  { value: "USER", label: "User Report", icon: Users, description: "User activity and growth" },
  { value: "COMPLIANCE", label: "Compliance Report", icon: Shield, description: "Alerts and resolutions" },
  { value: "REVENUE", label: "Revenue Report", icon: DollarSign, description: "Revenue breakdown" },
];

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("TRANSACTION");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [generatedReport, setGeneratedReport] = useState<Report | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch("/api/admin/reports");
      if (response.ok) {
        const data = await response.json();
        setReports(data.reports);
        setSummary(data.summary);
      } else {
        toast({
          title: "Error",
          description: "Failed to load reports",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: selectedType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Report generated successfully",
        });
        setGeneratedReport(result);
        fetchReports();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to generate report",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const openGenerateDialog = (type?: string) => {
    if (type) {
      setSelectedType(type);
    }
    setGeneratedReport(null);
    setDialogOpen(true);
  };

  const downloadReport = (report: Report) => {
    // Create a JSON file for download
    const data = report.data || { message: "Report data not available" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Generate and download platform reports
          </p>
        </div>
        <Button onClick={() => openGenerateDialog()}>
          <FileText className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalTransactions.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Transaction Volume</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(Number(summary.transactionVolume))}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">New Users (30d)</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.newUsers.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {reportTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Card
              key={type.value}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => openGenerateDialog(type.value)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{type.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Icon className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  {type.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Previously generated reports</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No reports generated</h3>
              <p className="text-muted-foreground">
                Generate your first report to get started
              </p>
              <Button className="mt-4" onClick={() => openGenerateDialog()}>
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{report.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {report.description}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(report.generatedAt).toLocaleDateString()}
                        </span>
                        {report.size && <span>{report.size}</span>}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadReport(report)}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Select report type and date range
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Report Type</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {generatedReport && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">{generatedReport.name}</h4>
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(generatedReport.data, null, 2)}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => downloadReport(generatedReport)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download JSON
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Close
            </Button>
            <Button onClick={handleGenerateReport} disabled={generating}>
              {generating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
