"use client";

import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Transaction {
  id: string;
  type: "incoming" | "outgoing";
  amount: number;
  currency: string;
  status: "completed" | "pending" | "failed";
  description: string;
  counterparty: {
    name: string;
    email: string;
    avatar?: string;
  };
  date: string;
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    type: "incoming",
    amount: 250.0,
    currency: "USD",
    status: "completed",
    description: "Payment for services",
    counterparty: {
      name: "John Smith",
      email: "john@example.com",
    },
    date: "2024-01-15T10:30:00",
  },
  {
    id: "2",
    type: "outgoing",
    amount: 75.5,
    currency: "USD",
    status: "completed",
    description: "Subscription payment",
    counterparty: {
      name: "Netflix",
      email: "billing@netflix.com",
    },
    date: "2024-01-14T15:45:00",
  },
  {
    id: "3",
    type: "incoming",
    amount: 1250.0,
    currency: "USD",
    status: "pending",
    description: "Freelance project payment",
    counterparty: {
      name: "Acme Corp",
      email: "payments@acme.com",
    },
    date: "2024-01-14T09:20:00",
  },
  {
    id: "4",
    type: "outgoing",
    amount: 42.99,
    currency: "USD",
    status: "completed",
    description: "Online purchase",
    counterparty: {
      name: "Amazon",
      email: "orders@amazon.com",
    },
    date: "2024-01-13T18:10:00",
  },
  {
    id: "5",
    type: "outgoing",
    amount: 500.0,
    currency: "USD",
    status: "failed",
    description: "Bank transfer",
    counterparty: {
      name: "Sarah Johnson",
      email: "sarah@example.com",
    },
    date: "2024-01-13T11:30:00",
  },
];

const statusConfig = {
  completed: { label: "Completed", variant: "default" as const },
  pending: { label: "Pending", variant: "secondary" as const },
  failed: { label: "Failed", variant: "destructive" as const },
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function RecentTransactions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
        <CardDescription>
          Your latest payment activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockTransactions.map((transaction) => {
            const initials = transaction.counterparty.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase();

            return (
              <div
                key={transaction.id}
                className="flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={transaction.counterparty.avatar} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center",
                        transaction.type === "incoming"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      )}
                    >
                      {transaction.type === "incoming" ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-none">
                      {transaction.counterparty.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {transaction.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-sm font-medium",
                        transaction.type === "incoming"
                          ? "text-green-600"
                          : ""
                      )}
                    >
                      {transaction.type === "incoming" ? "+" : "-"}
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(transaction.date)}
                    </p>
                  </div>
                  <Badge variant={statusConfig[transaction.status].variant}>
                    {statusConfig[transaction.status].label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View details</DropdownMenuItem>
                      <DropdownMenuItem>Download receipt</DropdownMenuItem>
                      <DropdownMenuItem>Report issue</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
