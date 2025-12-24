"use client";

import { useState, useEffect } from "react";
import {
  Users,
  AlertTriangle,
  FileText,
  UserCheck,
  ArrowUpRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";

interface AdminStats {
  stats: {
    totalUsers: number;
    activeUsers: number;
    pendingKyc: number;
    openDisputes: number;
    complianceAlerts: number;
    totalTransactions: number;
    recentTransactions: number;
    transactionVolume: number;
    pendingPayouts: number;
  };
  recentAlerts: Array<{
    id: string;
    type: string;
    title: string;
    user: string;
    severity: string;
    createdAt: string;
  }>;
  pendingKycUsers: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    type: string;
    status: string;
    submittedAt: string;
  }>;
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AdminDashboard() {
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/admin/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleKycAction = async (verificationId: string, action: "approve" | "reject") => {
    setActionLoading(verificationId);
    try {
      const response = await fetch("/api/admin/kyc", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verificationId, action }),
      });
      if (!response.ok) throw new Error("Failed to update KYC");
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update KYC");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
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
          <Button onClick={fetchData} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    pendingKyc: 0,
    openDisputes: 0,
    complianceAlerts: 0,
    totalUsers: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage users, support tickets, and disputes
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending KYC"
          value={stats.pendingKyc}
          icon={UserCheck}
          description="Awaiting review"
        />
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          description="Platform users"
        />
        <StatCard
          title="Active Disputes"
          value={stats.openDisputes}
          icon={AlertTriangle}
          description="In progress"
        />
        <StatCard
          title="Compliance Alerts"
          value={stats.complianceAlerts}
          icon={AlertTriangle}
          description="Requires attention"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* KYC Queue */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>KYC Review Queue</CardTitle>
              <CardDescription>Pending verification requests</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/kyc">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.pendingKycUsers && data.pendingKycUsers.length > 0 ? (
                data.pendingKycUsers.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {item.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{item.type}</Badge>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleKycAction(item.id, "reject")}
                          disabled={actionLoading === item.id}
                        >
                          <XCircle className="h-4 w-4 text-red-500" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleKycAction(item.id, "approve")}
                          disabled={actionLoading === item.id}
                        >
                          {actionLoading === item.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No pending KYC reviews</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Issues requiring attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/compliance">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recentAlerts && data.recentAlerts.length > 0 ? (
                data.recentAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${
                        alert.severity === "CRITICAL" ? "bg-red-500" :
                        alert.severity === "HIGH" ? "bg-orange-500" :
                        alert.severity === "MEDIUM" ? "bg-yellow-500" :
                        "bg-blue-500"
                      }`} />
                      <div>
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {alert.user}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(alert.createdAt)}
                      </span>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href="/admin/compliance">Review</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No recent alerts</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/admin/users">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Users</p>
                <p className="text-xs text-muted-foreground">Manage accounts</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/kyc">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">KYC Review</p>
                <p className="text-xs text-muted-foreground">Verify identities</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/disputes">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Disputes</p>
                <p className="text-xs text-muted-foreground">Resolve cases</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/compliance">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Compliance</p>
                <p className="text-xs text-muted-foreground">Review alerts</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
