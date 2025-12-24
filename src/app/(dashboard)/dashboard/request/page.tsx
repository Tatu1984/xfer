"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowDownLeft, Copy, Link, Mail, Send, Clock, CheckCircle, XCircle, MoreHorizontal, Loader2, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";

interface MoneyRequest {
  id: string;
  requesterId: string;
  requesteeId: string;
  amount: number;
  currency: string;
  note: string | null;
  status: string;
  createdAt: string;
  requester: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  requestee: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export default function RequestMoneyPage() {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [note, setNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setIsFetching(true);
      const response = await fetch("/api/auth/request-money");
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch requests:", err);
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const formatCurrency = (amount: number, curr: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: curr,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "DECLINED":
      case "CANCELLED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/request-money", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amount: parseFloat(amount),
          currency,
          note: note || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send request");
      }

      setSuccess("Money request sent successfully!");
      setEmail("");
      setAmount("");
      setNote("");
      fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (requestId: string, action: "pay" | "decline" | "cancel") => {
    setActionLoading(requestId);
    try {
      const response = await fetch("/api/auth/request-money", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Action failed");
      }

      setSuccess(action === "pay" ? "Payment sent!" : action === "decline" ? "Request declined" : "Request cancelled");
      fetchRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Link copied to clipboard!");
    setTimeout(() => setSuccess(""), 2000);
  };

  const paymentLink = `https://xfer.app/pay/${session?.user?.email || "user"}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Request Money</h1>
          <p className="text-muted-foreground">
            Send payment requests to friends and contacts
          </p>
        </div>
        <Button variant="outline" onClick={fetchRequests} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowDownLeft className="h-5 w-5" />
              New Request
            </CardTitle>
            <CardDescription>Create a new payment request</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Recipient Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
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
                <Label htmlFor="note">Note (optional)</Label>
                <Textarea
                  id="note"
                  placeholder="What's this for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Request
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Options</CardTitle>
            <CardDescription>Alternative ways to request money</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Link className="h-5 w-5 text-primary" />
                <span className="font-medium">Share Payment Link</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Generate a link that anyone can use to pay you
              </p>
              <div className="flex gap-2">
                <Input
                  value={paymentLink}
                  readOnly
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(paymentLink)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-4 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium">Request via Email</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Send a direct email request with payment details
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = `mailto:?subject=Payment Request&body=Please send payment to ${session?.user?.email}. You can pay at: ${paymentLink}`;
                }}
              >
                Compose Email Request
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>Your payment request history</CardDescription>
        </CardHeader>
        <CardContent>
          {isFetching ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No requests yet. Create your first request above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Person</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const isSender = request.requesterId === session?.user?.id;
                  const otherPerson = isSender ? request.requestee : request.requester;

                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Badge variant={isSender ? "outline" : "secondary"}>
                          {isSender ? "Sent" : "Received"}
                        </Badge>
                      </TableCell>
                      <TableCell>{otherPerson.email}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(request.amount, request.currency)}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {request.note || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(request.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(request.status)}
                          <Badge
                            variant={
                              request.status === "COMPLETED"
                                ? "default"
                                : request.status === "DECLINED" || request.status === "CANCELLED"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {request.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.status === "PENDING" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" disabled={actionLoading === request.id}>
                                {actionLoading === request.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <MoreHorizontal className="h-4 w-4" />
                                )}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!isSender && (
                                <>
                                  <DropdownMenuItem onClick={() => handleAction(request.id, "pay")}>
                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                    Pay Request
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleAction(request.id, "decline")}>
                                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                    Decline
                                  </DropdownMenuItem>
                                </>
                              )}
                              {isSender && (
                                <DropdownMenuItem onClick={() => handleAction(request.id, "cancel")}>
                                  <XCircle className="mr-2 h-4 w-4" />
                                  Cancel Request
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
