"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Plus, Shield, Zap, Ban, Eye, Settings, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface RiskRule {
  id: string;
  name: string;
  description: string;
  type: string;
  action: string;
  threshold: string;
  enabled: boolean;
  triggeredCount: number;
}

const defaultRiskRules: RiskRule[] = [
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
  const [rules, setRules] = useState<RiskRule[]>(defaultRiskRules);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<RiskRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for new/edit rule
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "VELOCITY",
    action: "FLAG",
    threshold: "",
  });

  const toggleRule = (ruleId: string) => {
    setRules(rules.map((rule) =>
      rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule
    ));
    toast.success("Rule status updated");
  };

  const handleAddRule = () => {
    if (!formData.name || !formData.threshold) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      const newRule: RiskRule = {
        id: `RULE${String(rules.length + 1).padStart(3, "0")}`,
        name: formData.name,
        description: formData.description,
        type: formData.type,
        action: formData.action,
        threshold: formData.threshold,
        enabled: true,
        triggeredCount: 0,
      };
      setRules([...rules, newRule]);
      setAddDialogOpen(false);
      setFormData({ name: "", description: "", type: "VELOCITY", action: "FLAG", threshold: "" });
      setSaving(false);
      toast.success("Rule created successfully");
    }, 500);
  };

  const handleUpdateRule = () => {
    if (!selectedRule) return;
    setSaving(true);
    setTimeout(() => {
      setRules(rules.map((rule) =>
        rule.id === selectedRule.id
          ? { ...rule, ...formData }
          : rule
      ));
      setSettingsDialogOpen(false);
      setSelectedRule(null);
      setSaving(false);
      toast.success("Rule updated successfully");
    }, 500);
  };

  const handleDeleteRule = (ruleId: string) => {
    setRules(rules.filter((rule) => rule.id !== ruleId));
    setSettingsDialogOpen(false);
    setSelectedRule(null);
    toast.success("Rule deleted");
  };

  const openSettings = (rule: RiskRule) => {
    setSelectedRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      type: rule.type,
      action: rule.action,
      threshold: rule.threshold,
    });
    setSettingsDialogOpen(true);
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
        <Button onClick={() => {
          setFormData({ name: "", description: "", type: "VELOCITY", action: "FLAG", threshold: "" });
          setAddDialogOpen(true);
        }}>
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
                    <Button variant="ghost" size="icon" onClick={() => openSettings(rule)}>
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Risk Rule</DialogTitle>
            <DialogDescription>
              Create a new fraud detection or risk management rule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Rule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., High Value Transaction"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this rule does..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VELOCITY">Velocity</SelectItem>
                    <SelectItem value="AMOUNT">Amount</SelectItem>
                    <SelectItem value="ACCOUNT_AGE">Account Age</SelectItem>
                    <SelectItem value="GEOGRAPHIC">Geographic</SelectItem>
                    <SelectItem value="FAILURE">Failure</SelectItem>
                    <SelectItem value="PATTERN">Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={formData.action} onValueChange={(value) => setFormData({ ...formData, action: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAG">Flag for Review</SelectItem>
                    <SelectItem value="REVIEW">Require Review</SelectItem>
                    <SelectItem value="BLOCK">Block Transaction</SelectItem>
                    <SelectItem value="SUSPEND">Suspend Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold">Threshold *</Label>
              <Input
                id="threshold"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                placeholder="e.g., $10,000 or 5/min"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRule} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Rule Settings</DialogTitle>
            <DialogDescription>
              Modify the configuration for {selectedRule?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Rule Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VELOCITY">Velocity</SelectItem>
                    <SelectItem value="AMOUNT">Amount</SelectItem>
                    <SelectItem value="ACCOUNT_AGE">Account Age</SelectItem>
                    <SelectItem value="GEOGRAPHIC">Geographic</SelectItem>
                    <SelectItem value="FAILURE">Failure</SelectItem>
                    <SelectItem value="PATTERN">Pattern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={formData.action} onValueChange={(value) => setFormData({ ...formData, action: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FLAG">Flag for Review</SelectItem>
                    <SelectItem value="REVIEW">Require Review</SelectItem>
                    <SelectItem value="BLOCK">Block Transaction</SelectItem>
                    <SelectItem value="SUSPEND">Suspend Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-threshold">Threshold</Label>
              <Input
                id="edit-threshold"
                value={formData.threshold}
                onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() => selectedRule && handleDeleteRule(selectedRule.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Rule
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRule} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
