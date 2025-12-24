"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertTriangle, Plus, Shield, Zap, Ban, Eye, Settings } from "lucide-react";

const riskRules = [
  {
    id: "RULE001",
    name: "High Value Transaction",
    description: "Flag transactions over $10,000",
    type: "VELOCITY",
    action: "FLAG",
    threshold: "$10,000",
    enabled: true,
    triggeredCount: 45,
  },
  {
    id: "RULE002",
    name: "Rapid Consecutive Transactions",
    description: "More than 5 transactions in 1 minute",
    type: "VELOCITY",
    action: "BLOCK",
    threshold: "5/min",
    enabled: true,
    triggeredCount: 12,
  },
  {
    id: "RULE003",
    name: "New Account Large Transfer",
    description: "Transfer over $1,000 from account less than 7 days old",
    type: "ACCOUNT_AGE",
    action: "REVIEW",
    threshold: "$1,000 / 7 days",
    enabled: true,
    triggeredCount: 89,
  },
  {
    id: "RULE004",
    name: "Suspicious Country",
    description: "Transactions from high-risk countries",
    type: "GEOGRAPHIC",
    action: "BLOCK",
    threshold: "Blacklisted regions",
    enabled: false,
    triggeredCount: 0,
  },
  {
    id: "RULE005",
    name: "Multiple Failed Payments",
    description: "More than 3 failed payments in 24 hours",
    type: "FAILURE",
    action: "SUSPEND",
    threshold: "3 failures/24h",
    enabled: true,
    triggeredCount: 23,
  },
];

export default function RiskRulesPage() {
  const [rules, setRules] = useState(riskRules);

  const toggleRule = (ruleId: string) => {
    setRules(rules.map((rule) =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "FLAG":
        return <Badge variant="outline" className="bg-yellow-50"><Eye className="mr-1 h-3 w-3" />Flag</Badge>;
      case "BLOCK":
        return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Block</Badge>;
      case "REVIEW":
        return <Badge variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" />Review</Badge>;
      case "SUSPEND":
        return <Badge variant="destructive"><Ban className="mr-1 h-3 w-3" />Suspend</Badge>;
      default:
        return <Badge>{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Risk Rules</h1>
          <p className="text-muted-foreground">
            Configure fraud detection and risk management rules
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Rule
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter((r) => r.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {rules.length} total rules
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Triggered Today</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">156</div>
            <p className="text-xs text-muted-foreground">Rule activations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Blocked</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">23</div>
            <p className="text-xs text-muted-foreground">Transactions blocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Awaiting manual review</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Rules Configuration</CardTitle>
          <CardDescription>
            Enable or disable rules and configure thresholds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Threshold</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Triggered</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {rule.description}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rule.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{rule.threshold}</TableCell>
                  <TableCell>{getActionBadge(rule.action)}</TableCell>
                  <TableCell>{rule.triggeredCount}</TableCell>
                  <TableCell>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => toggleRule(rule.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
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
