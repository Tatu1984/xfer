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
import { Settings, Shield, Bell, Database, Globe, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SystemSettings {
  platform: {
    platformName: string;
    supportEmail: string;
    defaultCurrency: string;
    defaultTimezone: string;
    maintenanceMode: boolean;
    newUserRegistrations: boolean;
  };
  transactionLimits: {
    dailyTransferLimitUnverified: number;
    dailyTransferLimitVerified: number;
    singleTransactionLimit: number;
    monthlyTransactionLimit: number;
  };
  security: {
    require2FAForAdmins: boolean;
    sessionTimeoutMinutes: number;
    ipWhitelisting: boolean;
    failedLoginLockout: boolean;
    maxFailedLoginAttempts: number;
    lockoutDurationMinutes: number;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    slackIntegration: boolean;
    slackWebhookUrl: string;
  };
}

export default function SystemSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch("/api/super-admin/settings");
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

  const saveSection = async (section: string, data: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch("/api/super-admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: result.message || "Settings saved successfully",
        });
        fetchSettings();
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
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground">
          Configure platform-wide settings and preferences
        </p>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <Settings className="mr-2 h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations">
            <Database className="mr-2 h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Settings</CardTitle>
              <CardDescription>General platform configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="platform-name">Platform Name</Label>
                  <Input
                    id="platform-name"
                    value={settings.platform.platformName}
                    onChange={(e) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, platformName: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support-email">Support Email</Label>
                  <Input
                    id="support-email"
                    value={settings.platform.supportEmail}
                    onChange={(e) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, supportEmail: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="default-currency">Default Currency</Label>
                  <Select
                    value={settings.platform.defaultCurrency}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, defaultCurrency: value }
                    })}
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
                <div className="space-y-2">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <Select
                    value={settings.platform.defaultTimezone}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      platform: { ...settings.platform, defaultTimezone: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="EST">Eastern Time</SelectItem>
                      <SelectItem value="PST">Pacific Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Disable access to the platform for non-admin users
                  </p>
                </div>
                <Switch
                  checked={settings.platform.maintenanceMode}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    platform: { ...settings.platform, maintenanceMode: checked }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>New User Registrations</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow new users to register on the platform
                  </p>
                </div>
                <Switch
                  checked={settings.platform.newUserRegistrations}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    platform: { ...settings.platform, newUserRegistrations: checked }
                  })}
                />
              </div>
              <Button onClick={() => saveSection("platform", settings.platform)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Platform Settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Transaction Limits</CardTitle>
              <CardDescription>Configure default transaction limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Daily Transfer Limit (Unverified)</Label>
                  <Input
                    type="number"
                    value={settings.transactionLimits.dailyTransferLimitUnverified}
                    onChange={(e) => setSettings({
                      ...settings,
                      transactionLimits: {
                        ...settings.transactionLimits,
                        dailyTransferLimitUnverified: Number(e.target.value)
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Daily Transfer Limit (Verified)</Label>
                  <Input
                    type="number"
                    value={settings.transactionLimits.dailyTransferLimitVerified}
                    onChange={(e) => setSettings({
                      ...settings,
                      transactionLimits: {
                        ...settings.transactionLimits,
                        dailyTransferLimitVerified: Number(e.target.value)
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Single Transaction Limit</Label>
                  <Input
                    type="number"
                    value={settings.transactionLimits.singleTransactionLimit}
                    onChange={(e) => setSettings({
                      ...settings,
                      transactionLimits: {
                        ...settings.transactionLimits,
                        singleTransactionLimit: Number(e.target.value)
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Monthly Transaction Limit</Label>
                  <Input
                    type="number"
                    value={settings.transactionLimits.monthlyTransactionLimit}
                    onChange={(e) => setSettings({
                      ...settings,
                      transactionLimits: {
                        ...settings.transactionLimits,
                        monthlyTransactionLimit: Number(e.target.value)
                      }
                    })}
                  />
                </div>
              </div>
              <Button onClick={() => saveSection("transactionLimits", settings.transactionLimits)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Transaction Limits
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security and authentication</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Require 2FA for Admins</Label>
                  <p className="text-sm text-muted-foreground">
                    Force all admin accounts to use two-factor authentication
                  </p>
                </div>
                <Switch
                  checked={settings.security.require2FAForAdmins}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    security: { ...settings.security, require2FAForAdmins: checked }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Session Timeout</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out inactive users
                  </p>
                </div>
                <Select
                  value={String(settings.security.sessionTimeoutMinutes)}
                  onValueChange={(value) => setSettings({
                    ...settings,
                    security: { ...settings.security, sessionTimeoutMinutes: Number(value) }
                  })}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>IP Whitelisting</Label>
                  <p className="text-sm text-muted-foreground">
                    Restrict admin access to specific IP addresses
                  </p>
                </div>
                <Switch
                  checked={settings.security.ipWhitelisting}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    security: { ...settings.security, ipWhitelisting: checked }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Failed Login Lockout</Label>
                  <p className="text-sm text-muted-foreground">
                    Lock accounts after failed login attempts
                  </p>
                </div>
                <Switch
                  checked={settings.security.failedLoginLockout}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    security: { ...settings.security, failedLoginLockout: checked }
                  })}
                />
              </div>
              {settings.security.failedLoginLockout && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Max Failed Attempts</Label>
                    <Input
                      type="number"
                      min={3}
                      max={10}
                      value={settings.security.maxFailedLoginAttempts}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: { ...settings.security, maxFailedLoginAttempts: Number(e.target.value) }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Lockout Duration (minutes)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={60}
                      value={settings.security.lockoutDurationMinutes}
                      onChange={(e) => setSettings({
                        ...settings,
                        security: { ...settings.security, lockoutDurationMinutes: Number(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              )}
              <Button onClick={() => saveSection("security", settings.security)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send email notifications for important events
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.emailNotifications}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, emailNotifications: checked }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send SMS for critical alerts
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.smsNotifications}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, smsNotifications: checked }
                  })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Slack Integration</Label>
                  <p className="text-sm text-muted-foreground">
                    Post alerts to Slack channel
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.slackIntegration}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, slackIntegration: checked }
                  })}
                />
              </div>
              {settings.notifications.slackIntegration && (
                <div className="space-y-2">
                  <Label>Slack Webhook URL</Label>
                  <Input
                    type="url"
                    placeholder="https://hooks.slack.com/services/..."
                    value={settings.notifications.slackWebhookUrl}
                    onChange={(e) => setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, slackWebhookUrl: e.target.value }
                    })}
                  />
                </div>
              )}
              <Button onClick={() => saveSection("notifications", settings.notifications)} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment Integrations</CardTitle>
              <CardDescription>Configure payment provider connections</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Globe className="h-8 w-8" />
                  <div>
                    <div className="font-medium">Stripe</div>
                    <div className="text-sm text-muted-foreground">Payment processing</div>
                  </div>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <Database className="h-8 w-8" />
                  <div>
                    <div className="font-medium">Plaid</div>
                    <div className="text-sm text-muted-foreground">Bank connections</div>
                  </div>
                </div>
                <Button variant="outline">Configure</Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Integration configuration requires additional setup. Contact your development team for assistance.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
