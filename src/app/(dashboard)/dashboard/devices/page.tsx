"use client";

import { useState, useEffect } from "react";
import {
  Smartphone,
  Monitor,
  Tablet,
  Trash2,
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface DeviceData {
  id: string;
  deviceName: string;
  deviceType: string;
  browser: string;
  os: string;
  isTrusted: boolean;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
}

const deviceIcons = {
  Mobile: Smartphone,
  Desktop: Monitor,
  Tablet: Tablet,
};

export default function DevicesPage() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceData | null>(null);
  const [processing, setProcessing] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch("/api/devices");
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices);
      }
    } catch (err) {
      console.error("Failed to fetch devices:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTrust = async (device: DeviceData) => {
    setProcessing(true);
    try {
      const response = await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: device.id,
          isTrusted: !device.isTrusted,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update device");
      }

      fetchDevices();
      toast({
        title: device.isTrusted ? "Device Untrusted" : "Device Trusted",
        description: device.isTrusted
          ? "This device is no longer trusted"
          : "This device is now trusted for secure login",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update device",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const renameDevice = async (deviceId: string) => {
    if (!newName.trim()) return;

    setProcessing(true);
    try {
      const response = await fetch("/api/devices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deviceId,
          deviceName: newName,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename device");
      }

      fetchDevices();
      setEditingName(null);
      setNewName("");
      toast({
        title: "Device Renamed",
        description: "Device name updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to rename device",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const removeDevice = async () => {
    if (!selectedDevice) return;

    setProcessing(true);
    try {
      const response = await fetch(`/api/devices?id=${selectedDevice.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to remove device");
      }

      fetchDevices();
      setShowRemoveDialog(false);
      setSelectedDevice(null);
      toast({
        title: "Device Removed",
        description: "The device has been removed from your account",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to remove device",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const startRename = (device: DeviceData) => {
    setEditingName(device.id);
    setNewName(device.deviceName);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Devices</h1>
        <p className="text-muted-foreground">
          Manage devices that have access to your account
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Trusted devices can log in without additional verification. Remove devices you don't recognize.
        </AlertDescription>
      </Alert>

      {/* Devices List */}
      <div className="space-y-4">
        {devices.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Smartphone className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Devices</h3>
              <p className="text-muted-foreground text-center">
                Devices will appear here after you log in
              </p>
            </CardContent>
          </Card>
        ) : (
          devices.map((device) => {
            const DeviceIcon = deviceIcons[device.deviceType as keyof typeof deviceIcons] || Monitor;

            return (
              <Card key={device.id} className={device.isCurrent ? "ring-2 ring-primary" : ""}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                        device.isTrusted ? "bg-green-100" : "bg-muted"
                      }`}>
                        <DeviceIcon className={`h-6 w-6 ${
                          device.isTrusted ? "text-green-600" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          {editingName === device.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="h-8 w-48"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => renameDevice(device.id)}
                                disabled={processing}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingName(null); setNewName(""); }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium">{device.deviceName}</p>
                              {device.isCurrent && (
                                <Badge className="bg-primary">Current</Badge>
                              )}
                              {device.isTrusted && (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                  <ShieldCheck className="h-3 w-3 mr-1" />
                                  Trusted
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{device.browser} on {device.os}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Last active {new Date(device.lastUsedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!device.isCurrent && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startRename(device)}
                          >
                            Rename
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleTrust(device)}
                            disabled={processing}
                          >
                            {device.isTrusted ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Untrust
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                Trust
                              </>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedDevice(device);
                              setShowRemoveDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Security Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Remove any devices you don't recognize immediately</li>
            <li>Only trust devices that you own and use regularly</li>
            <li>If you lose a device, remove it from this list right away</li>
            <li>Consider enabling two-factor authentication for extra security</li>
          </ul>
        </CardContent>
      </Card>

      {/* Remove Device Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove "{selectedDevice?.deviceName}"? This device will need to re-authenticate to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRemoveDialog(false);
                setSelectedDevice(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={removeDevice}
              disabled={processing}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                "Remove Device"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
