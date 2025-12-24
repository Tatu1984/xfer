"use client";

import { useState, useEffect } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Clock,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
}

const permissionOptions = [
  { id: "read", label: "Read", description: "View transactions and data" },
  { id: "write", label: "Write", description: "Create transactions and resources" },
  { id: "refund", label: "Refund", description: "Process refunds" },
  { id: "payout", label: "Payout", description: "Request payouts" },
];

export default function ApiKeysPage() {
  const { toast } = useToast();
  const [apiKeys, setApiKeys] = useState<ApiKeyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["read"]);
  const [newKeyExpiry, setNewKeyExpiry] = useState<string>("never");
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch("/api/api-keys");
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data.apiKeys);
      }
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async () => {
    if (!newKeyName.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter a name for the API key",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName,
          permissions: newKeyPermissions,
          expiresInDays: newKeyExpiry === "never" ? undefined : parseInt(newKeyExpiry),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      setNewApiKey(data.key);
      fetchApiKeys();
      toast({
        title: "API Key Created",
        description: "Save the key - you won't be able to see it again",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create API key",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const revokeApiKey = async (id: string) => {
    try {
      const response = await fetch(`/api/api-keys?id=${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke API key");
      }

      fetchApiKeys();
      toast({
        title: "API Key Revoked",
        description: "The API key has been revoked",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to revoke API key",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "API key copied to clipboard",
    });
  };

  const resetCreateDialog = () => {
    setNewKeyName("");
    setNewKeyPermissions(["read"]);
    setNewKeyExpiry("never");
    setNewApiKey(null);
    setShowNewKey(false);
    setShowCreateDialog(false);
  };

  const togglePermission = (permissionId: string) => {
    setNewKeyPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
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
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage API keys for programmatic access
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newApiKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Save this key securely - it won't be shown again
                  </DialogDescription>
                </DialogHeader>
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertDescription>
                    Copy this key now. You won't be able to see it again!
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      type={showNewKey ? "text" : "password"}
                      value={newApiKey}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNewKey(!showNewKey)}
                    >
                      {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(newApiKey)}
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
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for your application
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="key-name">Key Name</Label>
                    <Input
                      id="key-name"
                      placeholder="e.g., Production Server"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Permissions</Label>
                    <div className="space-y-3">
                      {permissionOptions.map((permission) => (
                        <div
                          key={permission.id}
                          className="flex items-start space-x-3"
                        >
                          <Checkbox
                            id={permission.id}
                            checked={newKeyPermissions.includes(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                          />
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor={permission.id}
                              className="text-sm font-medium cursor-pointer"
                            >
                              {permission.label}
                            </label>
                            <p className="text-sm text-muted-foreground">
                              {permission.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Expiration</Label>
                    <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="never">Never expires</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                        <SelectItem value="180">180 days</SelectItem>
                        <SelectItem value="365">1 year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createApiKey} disabled={creating}>
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Key"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No API Keys</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create an API key to integrate with our API
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Key
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {apiKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <Key className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{key.name}</p>
                        {!key.isActive && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="font-mono">{key.keyPrefix}...</span>
                        <span>
                          Created {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                        {key.lastUsedAt && (
                          <span>
                            Last used {new Date(key.lastUsedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {key.permissions.map((permission) => (
                        <Badge key={permission} variant="outline">
                          {permission}
                        </Badge>
                      ))}
                    </div>
                    {key.expiresAt && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Expires {new Date(key.expiresAt).toLocaleDateString()}
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => revokeApiKey(key.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Security Notice */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle className="text-base">Security Best Practices</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Never share your API keys publicly or commit them to version control</li>
            <li>Use environment variables to store keys in your application</li>
            <li>Rotate keys periodically and after any potential exposure</li>
            <li>Use the minimum permissions necessary for your use case</li>
            <li>Set expiration dates for keys used in less secure environments</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
