"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Smartphone,
  Key,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface MfaStatus {
  enabled: boolean;
}

interface MfaSetupData {
  secret: string;
  qrCode: string;
}

export default function SecurityPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>({ enabled: false });
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [setupData, setSetupData] = useState<MfaSetupData | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableToken, setDisableToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchMfaStatus();
  }, []);

  const fetchMfaStatus = async () => {
    try {
      const response = await fetch("/api/profile");
      if (response.ok) {
        const data = await response.json();
        setMfaStatus({ enabled: data.mfaEnabled || false });
      }
    } catch (err) {
      console.error("Failed to fetch MFA status:", err);
    } finally {
      setLoading(false);
    }
  };

  const startMfaSetup = async () => {
    setProcessing(true);
    try {
      const response = await fetch("/api/mfa/setup");
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start MFA setup");
      }
      const data = await response.json();
      setSetupData(data);
      setShowSetupDialog(true);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to start MFA setup",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const completeMfaSetup = async () => {
    if (verificationCode.length !== 6) {
      toast({
        title: "Invalid Code",
        description: "Please enter a 6-digit verification code",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verificationCode }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to enable MFA");
      }

      setBackupCodes(data.backupCodes);
      setShowBackupCodes(true);
      setMfaStatus({ enabled: true });
      setShowSetupDialog(false);
      setVerificationCode("");
      setSetupData(null);

      toast({
        title: "MFA Enabled",
        description: "Two-factor authentication has been enabled",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to enable MFA",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const disableMfa = async () => {
    if (!disablePassword || !disableToken) {
      toast({
        title: "Missing Information",
        description: "Please enter your password and verification code",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/mfa/setup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, token: disableToken }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to disable MFA");
      }

      setMfaStatus({ enabled: false });
      setShowDisableDialog(false);
      setDisablePassword("");
      setDisableToken("");

      toast({
        title: "MFA Disabled",
        description: "Two-factor authentication has been disabled",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to disable MFA",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast({
      title: "Copied",
      description: "Backup codes copied to clipboard",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="text-muted-foreground">
          Manage your account security and authentication
        </p>
      </div>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                mfaStatus.enabled ? "bg-green-100" : "bg-yellow-100"
              }`}>
                <Shield className={`h-5 w-5 ${
                  mfaStatus.enabled ? "text-green-600" : "text-yellow-600"
                }`} />
              </div>
              <div>
                <CardTitle className="text-lg">Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </div>
            </div>
            <Badge variant={mfaStatus.enabled ? "default" : "secondary"}>
              {mfaStatus.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {mfaStatus.enabled ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Your account is protected with two-factor authentication
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDisableDialog(true)}
              >
                Disable 2FA
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                Your account is not protected with two-factor authentication
              </div>
              <Button onClick={startMfaSetup} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <Smartphone className="mr-2 h-4 w-4" />
                    Enable 2FA
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Sessions</CardTitle>
          <CardDescription>
            Manage your active sessions across devices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Current Session</p>
                  <p className="text-sm text-muted-foreground">
                    Active now
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-green-50">Current</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Password</CardTitle>
          <CardDescription>
            Update your password regularly to keep your account secure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <a href="/dashboard/settings">Change Password</a>
          </Button>
        </CardContent>
      </Card>

      {/* MFA Setup Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {setupData?.qrCode && (
              <div className="flex justify-center">
                <img
                  src={setupData.qrCode}
                  alt="QR Code"
                  className="w-48 h-48"
                />
              </div>
            )}
            <div className="text-center text-sm text-muted-foreground">
              <p>Or enter this code manually:</p>
              <code className="block mt-1 p-2 bg-muted rounded font-mono text-xs break-all">
                {setupData?.secret}
              </code>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verification-code">Verification Code</Label>
              <Input
                id="verification-code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={completeMfaSetup} disabled={processing || verificationCode.length !== 6}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Enable"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Your Backup Codes</DialogTitle>
            <DialogDescription>
              Store these codes in a safe place. Each code can only be used once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                If you lose access to your authenticator app, you can use these codes to sign in.
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div key={index} className="text-center py-1">
                  {code}
                </div>
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={copyBackupCodes}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Codes
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowBackupCodes(false)}>
              I've Saved My Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Please confirm your password and enter a verification code
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Disabling 2FA will make your account less secure.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <div className="relative">
                <Input
                  id="disable-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-token">Verification Code</Label>
              <Input
                id="disable-token"
                placeholder="Enter 6-digit code"
                value={disableToken}
                onChange={(e) => setDisableToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={disableMfa} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Disabling...
                </>
              ) : (
                "Disable 2FA"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
