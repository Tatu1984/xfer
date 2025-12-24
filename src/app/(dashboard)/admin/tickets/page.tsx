"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, HelpCircle, MessageSquare, Clock, CheckCircle } from "lucide-react";

const tickets = [
  {
    id: "TKT001",
    subject: "Unable to withdraw funds",
    user: "john@example.com",
    category: "WITHDRAWAL",
    priority: "HIGH",
    status: "OPEN",
    createdAt: "2024-01-15T10:30:00Z",
    lastReply: "2024-01-15T11:00:00Z",
  },
  {
    id: "TKT002",
    subject: "KYC verification taking too long",
    user: "jane@example.com",
    category: "KYC",
    priority: "MEDIUM",
    status: "IN_PROGRESS",
    createdAt: "2024-01-15T09:00:00Z",
    lastReply: "2024-01-15T10:30:00Z",
  },
  {
    id: "TKT003",
    subject: "Question about fees",
    user: "mike@example.com",
    category: "GENERAL",
    priority: "LOW",
    status: "OPEN",
    createdAt: "2024-01-14T16:00:00Z",
    lastReply: null,
  },
  {
    id: "TKT004",
    subject: "Payment not received",
    user: "sarah@example.com",
    category: "PAYMENT",
    priority: "HIGH",
    status: "RESOLVED",
    createdAt: "2024-01-14T14:00:00Z",
    lastReply: "2024-01-15T09:00:00Z",
  },
];

export default function AdminTicketsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.id.toLowerCase().includes(search.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">
          Manage customer support requests
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Open Tickets</CardTitle>
            <HelpCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tickets.filter((t) => t.status === "OPEN").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tickets.filter((t) => t.status === "IN_PROGRESS").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Resolved Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tickets.filter((t) => t.status === "RESOLVED").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.5h</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>Customer support tickets</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <div>
                      <div className="font-mono text-sm">{ticket.id}</div>
                      <div className="text-sm">{ticket.subject}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{ticket.user}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ticket.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.priority === "HIGH"
                          ? "destructive"
                          : ticket.priority === "MEDIUM"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {ticket.priority}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        ticket.status === "RESOLVED"
                          ? "default"
                          : ticket.status === "IN_PROGRESS"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {ticket.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(ticket.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
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
