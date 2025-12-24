"use client";

import { useState, useEffect } from "react";
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  CreditCard,
  Download,
  RefreshCw,
  Loader2,
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
import { StatCard } from "@/components/dashboard/stat-card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";

interface VendorStats {
  stats: {
    revenue: number;
    revenueChange: number;
    orders: number;
    ordersChange: number;
    customers: number;
    pendingPayouts: number;
    availableBalance: number;
  };
  recentOrders: Array<{
    id: string;
    orderNumber: string;
    customerEmail: string | null;
    total: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  topProducts: Array<{
    name: string;
    sales: number;
    revenue: number;
  }>;
  payouts: {
    pending: number;
    lastPayout: { amount: number; date: string } | null;
    nextPayout: { amount: number; estimatedDate: string } | null;
  };
  business: {
    name: string;
    status: string;
  };
}

const statusConfig: Record<string, { label: string; color: string }> = {
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
  CAPTURED: { label: "Captured", color: "bg-green-100 text-green-800" },
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  AUTHORIZED: { label: "Authorized", color: "bg-blue-100 text-blue-800" },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-blue-800" },
  REFUNDED: { label: "Refunded", color: "bg-red-100 text-red-800" },
  VOIDED: { label: "Voided", color: "bg-gray-100 text-gray-800" },
};

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export default function VendorDashboard() {
  const { toast } = useToast();
  const [data, setData] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleExport = () => {
    if (!data) {
      toast({
        title: "No data to export",
        description: "Please wait for data to load",
        variant: "destructive",
      });
      return;
    }

    const exportData = {
      exportDate: new Date().toISOString(),
      business: data.business,
      stats: data.stats,
      recentOrders: data.recentOrders,
      topProducts: data.topProducts,
      payouts: data.payouts,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendor-report-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Your dashboard data has been exported",
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/vendor/stats");
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Business profile not found. Please complete your business setup.");
        }
        throw new Error("Failed to fetch data");
      }
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
    revenue: 0,
    revenueChange: 0,
    orders: 0,
    ordersChange: 0,
    customers: 0,
    pendingPayouts: 0,
    availableBalance: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {data?.business.name || "Vendor Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            Business dashboard overview
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button asChild>
            <Link href="/vendor/payouts">
              <DollarSign className="mr-2 h-4 w-4" />
              Request Payout
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.revenue)}
          icon={DollarSign}
          trend={stats.revenueChange !== 0 ? { value: stats.revenueChange, label: "from last month" } : undefined}
        />
        <StatCard
          title="Orders"
          value={stats.orders}
          icon={ShoppingCart}
          trend={stats.ordersChange !== 0 ? { value: stats.ordersChange, label: "from last month" } : undefined}
        />
        <StatCard
          title="Customers"
          value={stats.customers.toLocaleString()}
          icon={Users}
          description="Unique customers"
        />
        <StatCard
          title="Available Balance"
          value={formatCurrency(stats.availableBalance)}
          icon={CreditCard}
          description="Ready for payout"
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Latest customer orders</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/vendor/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.recentOrders && data.recentOrders.length > 0 ? (
                data.recentOrders.map((order) => {
                  const config = statusConfig[order.status] || { label: order.status, color: "bg-gray-100 text-gray-800" };
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{order.orderNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.customerEmail || "Guest"} •{" "}
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-medium">
                            {formatCurrency(order.total, order.currency)}
                          </p>
                        </div>
                        <Badge className={config.color}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No orders yet</p>
                  <p className="text-sm">Orders will appear here when customers make purchases</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>Best sellers this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.topProducts && data.topProducts.length > 0 ? (
                data.topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.sales} sales
                      </p>
                    </div>
                    <p className="font-medium text-sm">
                      {formatCurrency(product.revenue)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No product data yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link href="/vendor/orders">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium">Orders</p>
                <p className="text-xs text-muted-foreground">Manage orders</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/vendor/payouts">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Payouts</p>
                <p className="text-xs text-muted-foreground">Request payouts</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/vendor/customers">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium">Customers</p>
                <p className="text-xs text-muted-foreground">View customers</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/vendor/analytics">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Analytics</p>
                <p className="text-xs text-muted-foreground">View insights</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Payout Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payout Schedule</CardTitle>
            <CardDescription>Upcoming and recent payouts</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/vendor/payouts">View All</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(data?.payouts?.pending ?? 0) > 0 && (
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Pending Payout</p>
                    <p className="text-sm text-muted-foreground">
                      Processing soon
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(data?.payouts?.pending ?? 0)}
                  </p>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </div>
            )}
            {data?.payouts?.lastPayout && (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <ArrowDownRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Last Payout</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(data.payouts.lastPayout.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">
                    {formatCurrency(data.payouts.lastPayout.amount)}
                  </p>
                  <Badge variant="secondary">Completed</Badge>
                </div>
              </div>
            )}
            {!data?.payouts?.pending && !data?.payouts?.lastPayout && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No payout history yet</p>
                <p className="text-sm">Payouts will appear here once you have earnings</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
