"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Info,
  Settings,
  Trash2,
  Check,
} from "lucide-react";

const notifications = [
  {
    id: "1",
    title: "High-risk transaction detected",
    message: "Transaction TXN12345 flagged for manual review - amount exceeds threshold",
    type: "WARNING",
    read: false,
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    title: "KYC verification pending",
    message: "12 new KYC submissions awaiting review",
    type: "INFO",
    read: false,
    createdAt: "2024-01-15T09:15:00Z",
  },
  {
    id: "3",
    title: "Payout batch completed",
    message: "Successfully processed 45 payouts totaling $125,000",
    type: "SUCCESS",
    read: true,
    createdAt: "2024-01-15T08:00:00Z",
  },
  {
    id: "4",
    title: "System maintenance scheduled",
    message: "Planned maintenance window: Jan 20, 2024 2:00 AM - 4:00 AM UTC",
    type: "INFO",
    read: true,
    createdAt: "2024-01-14T16:00:00Z",
  },
  {
    id: "5",
    title: "Failed payout retry",
    message: "Payout PO789 failed after 3 retry attempts - requires manual intervention",
    type: "ERROR",
    read: false,
    createdAt: "2024-01-14T14:30:00Z",
  },
];

export default function AdminNotificationsPage() {
  const [notificationsList, setNotificationsList] = useState(notifications);

  const markAllAsRead = () => {
    setNotificationsList(notificationsList.map((n) => ({ ...n, read: true })));
  };

  const markAsRead = (id: string) => {
    setNotificationsList(
      notificationsList.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const deleteNotification = (id: string) => {
    setNotificationsList(notificationsList.filter((n) => n.id !== id));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SUCCESS":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "WARNING":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "ERROR":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const unreadCount = notificationsList.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">
            System alerts and notifications
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <Check className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All
            {unreadCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {notificationsList.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Bell className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notifications</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notificationsList.map((notification) => (
                <Card
                  key={notification.id}
                  className={notification.read ? "opacity-60" : ""}
                >
                  <CardContent className="flex items-start gap-4 p-4">
                    <div className="mt-1">{getTypeIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{notification.title}</h4>
                        {!notification.read && (
                          <Badge variant="default" className="text-xs">New</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markAsRead(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNotification(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="unread" className="space-y-4">
          {notificationsList.filter((n) => !n.read).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <p className="text-muted-foreground">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {notificationsList
                .filter((n) => !n.read)
                .map((notification) => (
                  <Card key={notification.id}>
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="mt-1">{getTypeIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium">{notification.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(notification.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Configure which notifications you want to receive
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>High-risk Transactions</Label>
                  <p className="text-sm text-muted-foreground">
                    Alert when transactions are flagged by risk rules
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>KYC Submissions</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify about new KYC verification requests
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Failed Payouts</Label>
                  <p className="text-sm text-muted-foreground">
                    Alert when payouts fail or require intervention
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>System Updates</Label>
                  <p className="text-sm text-muted-foreground">
                    Maintenance and system status notifications
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>User Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Daily/weekly summary reports
                  </p>
                </div>
                <Switch />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
