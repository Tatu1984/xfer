"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, DollarSign, Calendar } from "lucide-react";

const subscribers = [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    plan: "Pro Plan",
    amount: 29.99,
    status: "ACTIVE",
    nextBilling: "2024-02-15",
    subscribedAt: "2023-06-15T00:00:00Z",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane@example.com",
    plan: "Basic Plan",
    amount: 9.99,
    status: "ACTIVE",
    nextBilling: "2024-02-10",
    subscribedAt: "2023-08-10T00:00:00Z",
  },
  {
    id: "3",
    name: "Mike Johnson",
    email: "mike@example.com",
    plan: "Enterprise Plan",
    amount: 99.99,
    status: "ACTIVE",
    nextBilling: "2024-02-01",
    subscribedAt: "2023-09-01T00:00:00Z",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah@example.com",
    plan: "Pro Plan",
    amount: 29.99,
    status: "CANCELLED",
    nextBilling: null,
    subscribedAt: "2023-07-20T00:00:00Z",
  },
];

export default function VendorSubscribersPage() {
  const [search, setSearch] = useState("");

  const filteredSubscribers = subscribers.filter(
    (sub) =>
      sub.name.toLowerCase().includes(search.toLowerCase()) ||
      sub.email.toLowerCase().includes(search.toLowerCase()) ||
      sub.plan.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const activeSubscribers = subscribers.filter((s) => s.status === "ACTIVE");
  const mrr = activeSubscribers.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscribers</h1>
        <p className="text-muted-foreground">
          Manage your subscription customers
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscribers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscribers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">MRR</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(mrr)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.5%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Subscribers</CardTitle>
          <CardDescription>Your subscription customers</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search subscribers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subscriber</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Next Billing</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubscribers.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {sub.name.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{sub.name}</div>
                        <div className="text-sm text-muted-foreground">{sub.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{sub.plan}</TableCell>
                  <TableCell>{formatCurrency(sub.amount)}/mo</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.nextBilling || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.status === "ACTIVE" ? "default" : "secondary"}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
