"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Shield,
  FileText,
  Loader2,
  Check,
  Trash2,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

const typeConfig: Record<string, { icon: typeof Bell; color: string; bgColor: string }> = {
  TRANSACTION: { icon: DollarSign, color: "text-green-600", bgColor: "bg-green-100" },
  SECURITY: { icon: Shield, color: "text-red-600", bgColor: "bg-red-100" },
  KYC: { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-100" },
  ALERT: { icon: AlertCircle, color: "text-orange-600", bgColor: "bg-orange-100" },
  SYSTEM: { icon: Bell, color: "text-gray-600", bgColor: "bg-gray-100" },
  SUCCESS: { icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
};

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) throw new Error("Failed to fetch notifications");
      const data: NotificationsResponse = await response.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setActionLoading("all");
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to mark all as read");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete notification");
      const notification = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            Stay updated on your account activity
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead} disabled={actionLoading === "all"}>
              {actionLoading === "all" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Mark all as read
            </Button>
          )}
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/profile?tab=notifications">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Unread Notifications */}
      {unreadNotifications.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            New
            <Badge variant="destructive">{unreadCount}</Badge>
          </h2>
          <div className="space-y-3">
            {unreadNotifications.map((notification) => {
              const config = typeConfig[notification.type] || typeConfig.SYSTEM;
              const Icon = config.icon;
              return (
                <Card key={notification.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {notification.actionUrl && (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={notification.actionUrl}>View</Link>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleMarkAsRead(notification.id)}
                            disabled={actionLoading === notification.id}
                          >
                            {actionLoading === notification.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(notification.id)}
                            disabled={actionLoading === notification.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Read Notifications */}
      {readNotifications.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Earlier</h2>
          <div className="space-y-3">
            {readNotifications.map((notification) => {
              const config = typeConfig[notification.type] || typeConfig.SYSTEM;
              const Icon = config.icon;
              return (
                <Card key={notification.id} className="opacity-75">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium">{notification.title}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          {notification.actionUrl && (
                            <Button size="sm" variant="outline" asChild>
                              <Link href={notification.actionUrl}>View</Link>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(notification.id)}
                            disabled={actionLoading === notification.id}
                          >
                            {actionLoading === notification.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {notifications.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No notifications yet</p>
            <p className="text-sm">We'll notify you when something important happens</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
