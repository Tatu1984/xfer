"use client";

import { useState } from "react";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, MoreHorizontal, Store, Eye, Ban, DollarSign } from "lucide-react";

const vendors = [
  {
    id: "1",
    businessName: "Tech Solutions Inc",
    ownerName: "Robert Chen",
    email: "robert@techsolutions.com",
    status: "ACTIVE",
    kybStatus: "APPROVED",
    monthlyVolume: 45000,
    createdAt: "2023-06-15T00:00:00Z",
  },
  {
    id: "2",
    businessName: "Fashion Forward",
    ownerName: "Lisa Park",
    email: "lisa@fashionforward.com",
    status: "ACTIVE",
    kybStatus: "APPROVED",
    monthlyVolume: 32000,
    createdAt: "2023-07-20T00:00:00Z",
  },
  {
    id: "3",
    businessName: "Digital Services Co",
    ownerName: "Mark Wilson",
    email: "mark@digitalservices.co",
    status: "PENDING",
    kybStatus: "PENDING",
    monthlyVolume: 0,
    createdAt: "2024-01-10T00:00:00Z",
  },
];

export default function AdminVendorsPage() {
  const [search, setSearch] = useState("");

  const filteredVendors = vendors.filter(
    (vendor) =>
      vendor.businessName.toLowerCase().includes(search.toLowerCase()) ||
      vendor.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Vendor Management</h1>
        <p className="text-muted-foreground">
          View and manage vendor accounts
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
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
            <Store className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {vendors.filter((v) => v.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Monthly Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(vendors.reduce((sum, v) => sum + v.monthlyVolume, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Vendors</CardTitle>
          <CardDescription>Manage vendor accounts</CardDescription>
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
                <TableHead>Business</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>KYB</TableHead>
                <TableHead>Monthly Volume</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVendors.map((vendor) => (
                <TableRow key={vendor.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>
                          {vendor.businessName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{vendor.businessName}</div>
                        <div className="text-sm text-muted-foreground">{vendor.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vendor.status === "ACTIVE" ? "default" : "secondary"}
                    >
                      {vendor.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={vendor.kybStatus === "APPROVED" ? "outline" : "secondary"}
                    >
                      {vendor.kybStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(vendor.monthlyVolume)}</TableCell>
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
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Ban className="mr-2 h-4 w-4" />
                          Suspend Vendor
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
