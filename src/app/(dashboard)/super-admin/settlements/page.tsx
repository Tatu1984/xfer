"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, Calendar, Building, ArrowRight } from "lucide-react";

const settlements = [
  {
    id: "SET001",
    merchant: "Tech Solutions Inc",
    amount: 12500.00,
    fee: 375.00,
    netAmount: 12125.00,
    status: "COMPLETED",
    settledAt: "2024-01-15T00:00:00Z",
    period: "Jan 8-14, 2024",
  },
  {
    id: "SET002",
    merchant: "Fashion Forward",
    amount: 8900.00,
    fee: 267.00,
    netAmount: 8633.00,
    status: "PROCESSING",
    settledAt: null,
    period: "Jan 8-14, 2024",
  },
  {
    id: "SET003",
    merchant: "Digital Services Co",
    amount: 5600.00,
    fee: 168.00,
    netAmount: 5432.00,
    status: "PENDING",
    settledAt: null,
    period: "Jan 8-14, 2024",
  },
  {
    id: "SET004",
    merchant: "Global Imports LLC",
    amount: 15200.00,
    fee: 456.00,
    netAmount: 14744.00,
    status: "COMPLETED",
    settledAt: "2024-01-14T00:00:00Z",
    period: "Jan 1-7, 2024",
  },
];

export default function SettlementsPage() {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const totalPending = settlements
    .filter((s) => s.status === "PENDING" || s.status === "PROCESSING")
    .reduce((sum, s) => sum + s.netAmount, 0);

  const totalSettled = settlements
    .filter((s) => s.status === "COMPLETED")
    .reduce((sum, s) => sum + s.netAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settlements</h1>
          <p className="text-muted-foreground">
            Manage merchant payouts and settlements
          </p>
        </div>
        <Button>
          Process All Pending
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlement</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-muted-foreground">To be settled</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Settled (This Week)</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalSettled)}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Merchants</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">128</div>
            <p className="text-xs text-muted-foreground">With settlements</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next Settlement</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Tomorrow</div>
            <p className="text-xs text-muted-foreground">Jan 16, 2024</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settlement Queue</CardTitle>
          <CardDescription>Pending and recent settlements</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Gross Amount</TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>Net Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Settled At</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell className="font-mono text-sm">{settlement.id}</TableCell>
                  <TableCell className="font-medium">{settlement.merchant}</TableCell>
                  <TableCell className="text-muted-foreground">{settlement.period}</TableCell>
                  <TableCell>{formatCurrency(settlement.amount)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    -{formatCurrency(settlement.fee)}
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(settlement.netAmount)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        settlement.status === "COMPLETED"
                          ? "default"
                          : settlement.status === "PROCESSING"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {settlement.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {settlement.settledAt
                      ? new Date(settlement.settledAt).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {settlement.status === "PENDING" && (
                      <Button variant="ghost" size="sm">
                        Process <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
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
