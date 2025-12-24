"use client";

import { useState } from "react";
import {
  FlaskConical,
  CreditCard,
  Webhook,
  Code,
  Copy,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Play,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const testCards = [
  { number: "4111 1111 1111 1111", name: "Success", description: "Always succeeds", type: "success" },
  { number: "4000 0000 0000 0002", name: "Decline", description: "Always declined", type: "error" },
  { number: "4000 0000 0000 0069", name: "Expired", description: "Card expired", type: "error" },
  { number: "4000 0000 0000 0127", name: "CVC Fail", description: "CVC check fails", type: "warning" },
  { number: "4000 0000 0000 0119", name: "Error", description: "Processing error", type: "error" },
  { number: "4000 0000 0000 0341", name: "3D Secure", description: "Requires 3DS", type: "warning" },
];

const testBankAccounts = [
  { routing: "110000000", account: "000123456789", name: "Success Account", type: "success" },
  { routing: "110000000", account: "000111111116", name: "Failure Account", type: "error" },
];

const webhookEvents = [
  "transaction.completed",
  "order.created",
  "order.captured",
  "payout.completed",
  "dispute.created",
  "subscription.created",
];

export default function SandboxPage() {
  const { toast } = useToast();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("transaction.completed");
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ success: boolean; message: string } | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const testWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Missing URL",
        description: "Please enter a webhook URL to test",
        variant: "destructive",
      });
      return;
    }

    setTestingWebhook(true);
    setWebhookResult(null);

    try {
      // Simulate webhook test
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // In production, this would call the actual webhook test API
      setWebhookResult({
        success: true,
        message: `Successfully delivered ${selectedEvent} event to ${webhookUrl}`,
      });
    } catch (err) {
      setWebhookResult({
        success: false,
        message: "Failed to deliver webhook",
      });
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
          <FlaskConical className="h-5 w-5 text-purple-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sandbox</h1>
          <p className="text-muted-foreground">
            Test your integration in a safe environment
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">Test Mode</Badge>
      </div>

      <Tabs defaultValue="cards">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="cards">Test Cards</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="api">API Testing</TabsTrigger>
        </TabsList>

        <TabsContent value="cards" className="space-y-4">
          {/* Test Cards */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Test Credit Cards
              </CardTitle>
              <CardDescription>
                Use these card numbers to simulate different payment scenarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testCards.map((card) => (
                  <div
                    key={card.number}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Badge
                        variant={card.type === "success" ? "default" : card.type === "warning" ? "secondary" : "destructive"}
                      >
                        {card.name}
                      </Badge>
                      <div>
                        <p className="font-mono text-lg">{card.number}</p>
                        <p className="text-sm text-muted-foreground">{card.description}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(card.number.replace(/\s/g, ""))}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm">
                  <strong>Tip:</strong> Use any future expiration date (e.g., 12/25) and any 3-digit CVC.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Test Bank Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Test Bank Accounts</CardTitle>
              <CardDescription>
                Use these for ACH and bank transfer testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {testBankAccounts.map((account) => (
                  <div
                    key={account.account}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Badge variant={account.type === "success" ? "default" : "destructive"}>
                        {account.name}
                      </Badge>
                      <div>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Routing:</span>{" "}
                          <span className="font-mono">{account.routing}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Account:</span>{" "}
                          <span className="font-mono">{account.account}</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(`${account.routing}\n${account.account}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Test Webhook Delivery
              </CardTitle>
              <CardDescription>
                Send test events to your webhook endpoint
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://your-app.com/webhooks"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Event Type</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {webhookEvents.map((event) => (
                      <SelectItem key={event} value={event}>
                        {event}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={testWebhook} disabled={testingWebhook} className="w-full">
                {testingWebhook ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Send Test Event
                  </>
                )}
              </Button>
              {webhookResult && (
                <div
                  className={`p-4 rounded-lg flex items-center gap-3 ${
                    webhookResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  }`}
                >
                  {webhookResult.success ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5" />
                  )}
                  <p className="text-sm">{webhookResult.message}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sample Payload */}
          <Card>
            <CardHeader>
              <CardTitle>Sample Webhook Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{JSON.stringify({
  id: "evt_1234567890",
  type: selectedEvent,
  createdAt: new Date().toISOString(),
  data: {
    object: selectedEvent.split(".")[0],
    id: `${selectedEvent.split(".")[0]}_abc123`,
    amount: 1000,
    currency: "USD",
    status: "completed",
  },
  _sandbox: true,
}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                API Testing
              </CardTitle>
              <CardDescription>
                Quick references for testing the API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Authentication */}
              <div className="space-y-2">
                <h3 className="font-medium">Authentication</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`curl -X POST https://api.xfer.com/v1/transfers \\
  -H "Authorization: Bearer xfer_test_sk_..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1000, "currency": "USD"}'`}
                </pre>
              </div>

              {/* Create Transfer */}
              <div className="space-y-2">
                <h3 className="font-medium">Create Transfer</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`POST /api/transfers

{
  "recipientEmail": "recipient@example.com",
  "amount": 100.00,
  "currency": "USD",
  "description": "Test transfer"
}`}
                </pre>
              </div>

              {/* Create Order */}
              <div className="space-y-2">
                <h3 className="font-medium">Create Order</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
{`POST /api/checkout

{
  "merchantId": "bus_abc123",
  "items": [{
    "name": "Product",
    "price": 29.99,
    "quantity": 1
  }],
  "currency": "USD"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Environment Notice */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">Sandbox Environment</p>
                  <p className="text-sm text-yellow-700">
                    All transactions in sandbox mode are simulated. No real money is transferred.
                    Use test API keys (prefixed with <code className="bg-yellow-100 px-1 rounded">xfer_test_</code>).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
