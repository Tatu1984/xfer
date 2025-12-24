"use client";

import { useEffect, useState } from "react";
import {
  Users,
  DollarSign,
  ArrowUpRight,
  AlertTriangle,
  UserCheck,
  CreditCard,
  Scale,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";

interface DashboardStats {
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

const systemHealth = [
  { name: "API Gateway", status: "operational", uptime: 99.99 },
  { name: "Payment Processor", status: "operational", uptime: 99.95 },
  { name: "Database Cluster", status: "operational", uptime: 100 },
  { name: "Risk Engine", status: "operational", uptime: 99.8 },
];

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function SuperAdminDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/stats");
        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

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
          <Button onClick={() => window.location.reload()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {
    totalUsers: 0,
    activeUsers: 0,
    pendingKyc: 0,
    openDisputes: 0,
    complianceAlerts: 0,
    totalTransactions: 0,
    recentTransactions: 0,
    transactionVolume: 0,
    pendingPayouts: 0,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Complete platform overview and management
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={formatNumber(stats.totalUsers)}
          icon={Users}
          trend={{ value: 12.5, label: "from last month" }}
        />
        <StatCard
          title="Transaction Volume"
          value={formatCurrency(stats.transactionVolume)}
          icon={DollarSign}
          trend={{ value: 8.2, label: "from last month" }}
        />
        <StatCard
          title="Pending KYC"
          value={stats.pendingKyc}
          icon={UserCheck}
          description="Awaiting review"
        />
        <StatCard
          title="Compliance Alerts"
          value={stats.complianceAlerts}
          icon={AlertTriangle}
          description="Requires attention"
        />
      </div>

      {/* Second Row Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Users"
          value={formatNumber(stats.activeUsers)}
          icon={TrendingUp}
          description={
            stats.totalUsers > 0
              ? `${((stats.activeUsers / stats.totalUsers) * 100).toFixed(1)}% of total`
              : "0% of total"
          }
        />
        <StatCard
          title="Total Transactions"
          value={formatNumber(stats.totalTransactions)}
          icon={CreditCard}
          trend={{ value: 15.3, label: "from last month" }}
        />
        <StatCard
          title="Open Disputes"
          value={stats.openDisputes}
          icon={Scale}
          description="Active cases"
        />
        <StatCard
          title="Pending Payouts"
          value={formatCurrency(stats.pendingPayouts)}
          icon={ArrowUpRight}
          description="To be processed"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Alerts</CardTitle>
              <CardDescription>Issues requiring immediate attention</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/super-admin/compliance">View All</Link>
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
                        <Link href="/super-admin/compliance">Review</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent alerts
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pending KYC */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Pending KYC Reviews</CardTitle>
              <CardDescription>Users awaiting verification</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/super-admin/kyc">View Queue</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.pendingKycUsers && data.pendingKycUsers.length > 0 ? (
                data.pendingKycUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{user.name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.type === "Business" ? "secondary" : "outline"}>
                        {user.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTimeAgo(user.submittedAt)}
                      </span>
                      <Button size="sm" asChild>
                        <Link href="/super-admin/kyc">Review</Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No pending KYC reviews
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
          <CardDescription>Current status of platform services</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {systemHealth.map((service) => (
              <div key={service.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{service.name}</span>
                  <Badge
                    variant={service.status === "operational" ? "default" : "destructive"}
                    className={service.status === "operational" ? "bg-green-500" : ""}
                  >
                    {service.status === "operational" ? "Operational" : "Degraded"}
                  </Badge>
                </div>
                <Progress value={service.uptime} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  {service.uptime}% uptime
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
