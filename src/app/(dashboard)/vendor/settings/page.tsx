"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Bell, CreditCard, Shield, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VendorSettings {
  timezone: string;
  currency: string;
  statementDescriptor: string;
  orderNotifications: boolean;
  payoutNotifications: boolean;
  weeklyReports: boolean;
  marketingUpdates: boolean;
  payoutSchedule: string;
  minimumPayoutAmount: number;
  automaticRefunds: boolean;
  automaticRefundThreshold: number;
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
}

export default function VendorSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<VendorSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/vendor/settings");
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      } else {
        toast({
          title: "Error",
          description: "Failed to load settings",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const response = await fetch("/api/vendor/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Settings saved successfully",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to save settings",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground">Failed to load settings</p>
        <Button onClick={fetchSettings} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your vendor account settings
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="mr-2 h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Basic account preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PST">Pacific Time (PST)</SelectItem>
                      <SelectItem value="MST">Mountain Time (MST)</SelectItem>
                      <SelectItem value="CST">Central Time (CST)</SelectItem>
                      <SelectItem value="EST">Eastern Time (EST)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Default Currency</Label>
                  <Select
                    value={settings.currency}
                    onValueChange={(value) => setSettings({ ...settings, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar</SelectItem>
                      <SelectItem value="EUR">EUR - Euro</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="statement">Statement Descriptor</Label>
                <Input
                  id="statement"
                  value={settings.statementDescriptor}
                  onChange={(e) => setSettings({ ...settings, statementDescriptor: e.target.value })}
                  maxLength={22}
                />
                <p className="text-xs text-muted-foreground">
                  This appears on customer bank statements (max 22 characters)
                </p>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save General Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>Manage how you receive notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Order Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when you receive new orders
                  </p>
                </div>
                <Switch
                  checked={settings.orderNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, orderNotifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Payout Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified when payouts are processed
                  </p>
                </div>
                <Switch
                  checked={settings.payoutNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, payoutNotifications: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly business summary via email
                  </p>
                </div>
                <Switch
                  checked={settings.weeklyReports}
                  onCheckedChange={(checked) => setSettings({ ...settings, weeklyReports: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Marketing Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Product updates and feature announcements
                  </p>
                </div>
                <Switch
                  checked={settings.marketingUpdates}
                  onCheckedChange={(checked) => setSettings({ ...settings, marketingUpdates: checked })}
                />
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>Configure payment preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Payout Schedule</Label>
                <Select
                  value={settings.payoutSchedule}
                  onValueChange={(value) => setSettings({ ...settings, payoutSchedule: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Minimum Payout Amount</Label>
                <Input
                  type="number"
                  value={settings.minimumPayoutAmount}
                  onChange={(e) => setSettings({ ...settings, minimumPayoutAmount: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  Only process payouts when balance exceeds this amount
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Automatic Refunds</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically process refund requests under ${settings.automaticRefundThreshold}
                  </p>
                </div>
                <Switch
                  checked={settings.automaticRefunds}
                  onCheckedChange={(checked) => setSettings({ ...settings, automaticRefunds: checked })}
                />
              </div>
              {settings.automaticRefunds && (
                <div className="space-y-2">
                  <Label>Automatic Refund Threshold</Label>
                  <Input
                    type="number"
                    value={settings.automaticRefundThreshold}
                    onChange={(e) => setSettings({ ...settings, automaticRefundThreshold: Number(e.target.value) })}
                  />
                </div>
              )}
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Payment Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Protect your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security
                  </p>
                </div>
                <Switch
                  checked={settings.twoFactorEnabled}
                  onCheckedChange={(checked) => setSettings({ ...settings, twoFactorEnabled: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Login Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Get notified of new logins
                  </p>
                </div>
                <Switch
                  checked={settings.loginNotifications}
                  onCheckedChange={(checked) => setSettings({ ...settings, loginNotifications: checked })}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Change Password</Label>
                <Button variant="outline" asChild>
                  <a href="/dashboard/settings">Update Password in User Settings</a>
                </Button>
              </div>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
