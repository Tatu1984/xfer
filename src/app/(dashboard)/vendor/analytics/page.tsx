"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users } from "lucide-react";
import { useState } from "react";

export default function VendorAnalyticsPage() {
  const [period, setPeriod] = useState("30d");

  const stats = [
    {
      title: "Revenue",
      value: "$12,450",
      change: "+15.3%",
      trend: "up",
      icon: DollarSign,
    },
    {
      title: "Orders",
      value: "156",
      change: "+8.2%",
      trend: "up",
      icon: ShoppingCart,
    },
    {
      title: "Customers",
      value: "89",
      change: "+12.1%",
      trend: "up",
      icon: Users,
    },
    {
      title: "Avg Order Value",
      value: "$79.81",
      change: "-2.4%",
      trend: "down",
      icon: BarChart3,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your business performance
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="flex items-center text-sm">
                {stat.trend === "up" ? (
                  <TrendingUp className="mr-1 h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="mr-1 h-4 w-4 text-red-500" />
                )}
                <span className={stat.trend === "up" ? "text-green-500" : "text-red-500"}>
                  {stat.change}
                </span>
                <span className="text-muted-foreground ml-1">vs last period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Daily revenue for the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
            <BarChart3 className="h-16 w-16 opacity-50" />
            <span className="ml-4">Revenue chart would be displayed here</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Orders Over Time</CardTitle>
            <CardDescription>Daily orders for the selected period</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-16 w-16 opacity-50" />
            <span className="ml-4">Orders chart would be displayed here</span>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Best performing products this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { name: "Product A", sales: 45, revenue: 2250 },
              { name: "Product B", sales: 38, revenue: 1900 },
              { name: "Product C", sales: 32, revenue: 1600 },
              { name: "Product D", sales: 25, revenue: 1250 },
            ].map((product) => (
              <div key={product.name} className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{product.name}</div>
                  <div className="text-sm text-muted-foreground">{product.sales} sales</div>
                </div>
                <div className="font-medium">${product.revenue.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
