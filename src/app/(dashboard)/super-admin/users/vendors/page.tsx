"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, MoreHorizontal, Store, Eye, Ban, CheckCircle, DollarSign, Loader2, Building2 } from "lucide-react";

interface Vendor {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  createdAt: string;
  business?: {
    id: string;
    name: string;
    type: string;
    status: string;
    kybStatus: string;
  } | null;
  walletBalance: number;
  transactionCount: number;
}

export default function VendorsManagementPage() {
  const [search, setSearch] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [dialogType, setDialogType] = useState<"details" | "business" | null>(null);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/admin/users?role=VENDOR&limit=100");
      if (response.ok) {
        const data = await response.json();
        setVendors(data.users || []);
      }
    } catch (error) {
      console.error("Failed to fetch vendors:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (vendorId: string, newStatus: string) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: vendorId, status: newStatus }),
      });
      if (response.ok) {
        fetchVendors();
      }
    } catch (error) {
      console.error("Failed to update vendor:", error);
    }
  };

  const filteredVendors = vendors.filter(
    (vendor) =>
      (vendor.business?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (vendor.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
      vendor.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
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
          <h1 className="text-3xl font-bold">Vendor Management</h1>
          <p className="text-muted-foreground">
            View and manage vendor accounts
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Vendors</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendors.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendors.filter((v) => v.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Store className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendors.filter((v) => v.status === "PENDING").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(vendors.reduce((sum, v) => sum + (v.walletBalance || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>View and manage vendor accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Business</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Transactions</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {(vendor.displayName || vendor.email).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">{vendor.displayName || `${vendor.firstName || ""} ${vendor.lastName || ""}`.trim() || "Unknown"}</div>
                          <div className="text-sm text-muted-foreground">{vendor.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.business ? (
                        <div>
                          <div className="font-medium">{vendor.business.name}</div>
                          <div className="text-xs text-muted-foreground">{vendor.business.type}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No business</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          vendor.status === "ACTIVE"
                            ? "default"
                            : vendor.status === "PENDING"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {vendor.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(vendor.walletBalance || 0)}</TableCell>
                    <TableCell>{vendor.transactionCount || 0}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(vendor.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedVendor(vendor);
                            setDialogType("details");
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedVendor(vendor);
                            setDialogType("business");
                          }}>
                            <Building2 className="mr-2 h-4 w-4" />
                            View Business
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {vendor.status === "ACTIVE" ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleStatusChange(vendor.id, "SUSPENDED")}
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Suspend Vendor
                            </DropdownMenuItem>
                          ) : vendor.status === "SUSPENDED" ? (
                            <DropdownMenuItem
                              className="text-green-600"
                              onClick={() => handleStatusChange(vendor.id, "ACTIVE")}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Reactivate Vendor
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Details Dialog */}
      <Dialog open={dialogType === "details"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vendor Details</DialogTitle>
            <DialogDescription>
              Account information for {selectedVendor?.displayName || selectedVendor?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedVendor.email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={selectedVendor.status === "ACTIVE" ? "default" : "secondary"}>
                    {selectedVendor.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {selectedVendor.displayName || `${selectedVendor.firstName || ""} ${selectedVendor.lastName || ""}`.trim() || "Not set"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance</p>
                  <p className="font-medium">{formatCurrency(selectedVendor.walletBalance || 0)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                  <p className="font-medium">{selectedVendor.transactionCount || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Joined</p>
                  <p className="font-medium">{new Date(selectedVendor.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Business Dialog */}
      <Dialog open={dialogType === "business"} onOpenChange={(open) => !open && setDialogType(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Business Information</DialogTitle>
            <DialogDescription>
              Business details for {selectedVendor?.displayName || selectedVendor?.email}
            </DialogDescription>
          </DialogHeader>
          {selectedVendor && (
            <div className="space-y-4">
              {selectedVendor.business ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Business Name</p>
                    <p className="font-medium">{selectedVendor.business.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Type</p>
                    <p className="font-medium">{selectedVendor.business.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <Badge variant={selectedVendor.business.status === "ACTIVE" ? "default" : "secondary"}>
                      {selectedVendor.business.status}
                    </Badge>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">KYB Status</p>
                    <Badge variant={selectedVendor.business.kybStatus === "APPROVED" ? "default" : "secondary"}>
                      {selectedVendor.business.kybStatus}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No business profile set up</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
