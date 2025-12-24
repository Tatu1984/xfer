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
import { Search, Download, History, AlertCircle, CheckCircle, Info } from "lucide-react";

const activityLogs = [
  {
    id: "LOG001",
    action: "USER_LOGIN",
    actor: "john@example.com",
    target: null,
    details: "Successful login from 192.168.1.1",
    level: "INFO",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "LOG002",
    action: "KYC_APPROVED",
    actor: "admin@xfer.com",
    target: "jane@example.com",
    details: "KYC verification approved",
    level: "SUCCESS",
    createdAt: "2024-01-15T10:25:00Z",
  },
  {
    id: "LOG003",
    action: "TRANSACTION_BLOCKED",
    actor: "SYSTEM",
    target: "TXN123456",
    details: "Transaction blocked by risk rule: High Value",
    level: "WARNING",
    createdAt: "2024-01-15T10:20:00Z",
  },
  {
    id: "LOG004",
    action: "LOGIN_FAILED",
    actor: "unknown@example.com",
    target: null,
    details: "Failed login attempt - invalid password (attempt 3/5)",
    level: "WARNING",
    createdAt: "2024-01-15T10:15:00Z",
  },
  {
    id: "LOG005",
    action: "USER_SUSPENDED",
    actor: "admin@xfer.com",
    target: "fraudster@example.com",
    details: "Account suspended for suspicious activity",
    level: "ERROR",
    createdAt: "2024-01-15T10:10:00Z",
  },
  {
    id: "LOG006",
    action: "PAYOUT_PROCESSED",
    actor: "SYSTEM",
    target: "PO12345",
    details: "Payout of $5,000 processed successfully",
    level: "SUCCESS",
    createdAt: "2024-01-15T10:05:00Z",
  },
  {
    id: "LOG007",
    action: "SETTINGS_UPDATED",
    actor: "superadmin@xfer.com",
    target: "SYSTEM_SETTINGS",
    details: "Updated transaction limits",
    level: "INFO",
    createdAt: "2024-01-15T10:00:00Z",
  },
];

export default function ActivityLogsPage() {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const filteredLogs = activityLogs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    return matchesSearch && matchesLevel;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "SUCCESS":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "WARNING":
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case "ERROR":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "SUCCESS":
        return <Badge className="bg-green-100 text-green-800">SUCCESS</Badge>;
      case "WARNING":
        return <Badge className="bg-yellow-100 text-yellow-800">WARNING</Badge>;
      case "ERROR":
        return <Badge variant="destructive">ERROR</Badge>;
      default:
        return <Badge variant="secondary">INFO</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Logs</h1>
          <p className="text-muted-foreground">
            View system and user activity logs
          </p>
        </div>
        <Button variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Logs
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12,456</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Warnings</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">89</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Critical issues</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">99.2%</div>
            <p className="text-xs text-muted-foreground">Operations successful</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>System and user activity logs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
                <SelectItem value="SUCCESS">Success</SelectItem>
                <SelectItem value="WARNING">Warning</SelectItem>
                <SelectItem value="ERROR">Error</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getLevelIcon(log.level)}
                      {getLevelBadge(log.level)}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{log.action}</TableCell>
                  <TableCell>{log.actor}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.target || "-"}
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {log.details}
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
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
