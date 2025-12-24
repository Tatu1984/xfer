"use client";

import { useState, useEffect } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface WebhookData {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastTriggeredAt: string | null;
  failureCount: number;
  createdAt: string;
}

const eventGroups = {
  "Transactions": [
    { id: "transaction.created", label: "Transaction Created" },
    { id: "transaction.completed", label: "Transaction Completed" },
    { id: "transaction.failed", label: "Transaction Failed" },
    { id: "transaction.refunded", label: "Transaction Refunded" },
  ],
  "Orders": [
    { id: "order.created", label: "Order Created" },
    { id: "order.authorized", label: "Order Authorized" },
    { id: "order.captured", label: "Order Captured" },
    { id: "order.voided", label: "Order Voided" },
    { id: "order.refunded", label: "Order Refunded" },
  ],
  "Payouts": [
    { id: "payout.created", label: "Payout Created" },
    { id: "payout.completed", label: "Payout Completed" },
    { id: "payout.failed", label: "Payout Failed" },
  ],
  "Disputes": [
    { id: "dispute.created", label: "Dispute Created" },
    { id: "dispute.updated", label: "Dispute Updated" },
    { id: "dispute.resolved", label: "Dispute Resolved" },
  ],
  "Subscriptions": [
    { id: "subscription.created", label: "Subscription Created" },
    { id: "subscription.updated", label: "Subscription Updated" },
    { id: "subscription.cancelled", label: "Subscription Cancelled" },
    { id: "subscription.payment_failed", label: "Payment Failed" },
  ],
};

export default function WebhooksPage() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    try {
      const response = await fetch("/api/webhooks");
      if (response.ok) {
        const data = await response.json();
        setWebhooks(data.webhooks);
      }
    } catch (err) {
      console.error("Failed to fetch webhooks:", err);
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!newWebhookUrl || newWebhookEvents.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please enter a URL and select at least one event",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newWebhookUrl,
          events: newWebhookEvents,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create webhook");
      }

      setNewWebhookSecret(data.secret);
      fetchWebhooks();
      toast({
        title: "Webhook Created",
        description: "Save the secret key - you won't be able to see it again",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create webhook",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const toggleWebhook = async (id: string, isActive: boolean) => {
    try {
      const response = await fetch("/api/webhooks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive }),
      });

      if (!response.ok) {
        throw new Error("Failed to update webhook");
      }

      fetchWebhooks();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update webhook",
        variant: "destructive",
      });
    }
  };

  const deleteWebhook = async (id: string) => {
    try {
      const response = await fetch(`/api/webhooks?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete webhook");
      }

      fetchWebhooks();
      toast({
        title: "Webhook Deleted",
        description: "The webhook has been removed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete webhook",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Secret copied to clipboard",
    });
  };

  const resetCreateDialog = () => {
    setNewWebhookUrl("");
    setNewWebhookEvents([]);
    setNewWebhookSecret(null);
    setShowCreateDialog(false);
  };

  const toggleEvent = (eventId: string) => {
    setNewWebhookEvents((prev) =>
      prev.includes(eventId)
        ? prev.filter((e) => e !== eventId)
        : [...prev, eventId]
    );
  };

  const toggleAllEvents = (group: string) => {
    const groupEvents = eventGroups[group as keyof typeof eventGroups].map((e) => e.id);
    const allSelected = groupEvents.every((e) => newWebhookEvents.includes(e));

    if (allSelected) {
      setNewWebhookEvents((prev) => prev.filter((e) => !groupEvents.includes(e)));
    } else {
      setNewWebhookEvents((prev) => [...new Set([...prev, ...groupEvents])]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
          <p className="text-muted-foreground">
            Receive real-time notifications for events
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            {newWebhookSecret ? (
              <>
                <DialogHeader>
                  <DialogTitle>Webhook Created</DialogTitle>
                  <DialogDescription>
                    Save this signing secret securely
                  </DialogDescription>
                </DialogHeader>
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription>
                    This secret will only be shown once. Save it now!
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Signing Secret</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showSecret ? "text" : "password"}
                      value={newWebhookSecret}
                      readOnly
                      className="font-mono"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowSecret(!showSecret)}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(newWebhookSecret)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={resetCreateDialog}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create Webhook</DialogTitle>
                  <DialogDescription>
                    Configure a new webhook endpoint
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Endpoint URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://your-app.com/webhooks"
                      value={newWebhookUrl}
                      onChange={(e) => setNewWebhookUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Events to Listen For</Label>
                    <div className="space-y-4 max-h-[300px] overflow-y-auto border rounded-lg p-4">
                      {Object.entries(eventGroups).map(([group, events]) => (
                        <div key={group} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium">{group}</h4>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleAllEvents(group)}
                            >
                              {events.every((e) => newWebhookEvents.includes(e.id))
                                ? "Deselect All"
                                : "Select All"}
                            </Button>
                          </div>
                          <div className="grid gap-2">
                            {events.map((event) => (
                              <div
                                key={event.id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={event.id}
                                  checked={newWebhookEvents.includes(event.id)}
                                  onCheckedChange={() => toggleEvent(event.id)}
                                />
                                <label
                                  htmlFor={event.id}
                                  className="text-sm cursor-pointer"
                                >
                                  {event.label}
                                  <span className="text-muted-foreground ml-2 font-mono text-xs">
                                    {event.id}
                                  </span>
                                </label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createWebhook} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Webhook"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Webhooks List */}
      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Webhooks</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a webhook to receive real-time event notifications
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${webhook.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                    <div>
                      <CardTitle className="text-base font-mono">{webhook.url}</CardTitle>
                      <CardDescription>
                        Created {new Date(webhook.createdAt).toLocaleDateString()}
                        {webhook.lastTriggeredAt && (
                          <> • Last triggered {new Date(webhook.lastTriggeredAt).toLocaleDateString()}</>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {webhook.failureCount > 0 && (
                      <Badge variant="destructive">
                        {webhook.failureCount} failures
                      </Badge>
                    )}
                    <Switch
                      checked={webhook.isActive}
                      onCheckedChange={(checked) => toggleWebhook(webhook.id, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteWebhook(webhook.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="secondary" className="font-mono text-xs">
                      {event}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Signature Verification</CardTitle>
          <CardDescription>
            Verify webhook signatures to ensure authenticity
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret, timestamp) {
  const signedPayload = \`\${timestamp}.\${payload}\`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
