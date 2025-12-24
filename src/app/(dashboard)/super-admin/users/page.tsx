"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  MoreHorizontal,
  ArrowUpDown,
  UserPlus,
  Download,
  Filter,
  Shield,
  Ban,
  Trash2,
  Eye,
  Mail,
  Loader2,
  CheckCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/dashboard/data-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface User {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "VENDOR" | "USER";
  status: "ACTIVE" | "PENDING" | "SUSPENDED" | "CLOSED";
  kycStatus: string;
  walletBalance: number;
  transactionCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "bg-purple-100 text-purple-800",
  ADMIN: "bg-blue-100 text-blue-800",
  VENDOR: "bg-green-100 text-green-800",
  USER: "bg-gray-100 text-gray-800",
};

const statusColors: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  SUSPENDED: "bg-red-100 text-red-800",
  CLOSED: "bg-gray-100 text-gray-800",
};

const kycColors: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    type: "role" | "status" | null;
    user: User | null;
  }>({ open: false, type: null, user: null });
  const [actionLoading, setActionLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "20",
        page: pagination.page.toString(),
      });
      if (roleFilter !== "all") params.append("role", roleFilter);
      if (statusFilter !== "all") params.append("status", statusFilter);

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error("Failed to fetch users");

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, statusFilter, pagination.page]);

  const handleUpdateUser = async (userId: string, updates: { role?: string; status?: string }) => {
    setActionLoading(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...updates }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update user");
      }

      setActionDialog({ open: false, type: null, user: null });
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setActionLoading(false);
    }
  };

  const columns: ColumnDef<User>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "displayName",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          User
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original;
        const name = user.displayName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Unknown";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.getValue("role") as string;
        return (
          <Badge className={roleColors[role] || "bg-gray-100"} variant="secondary">
            {role.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge className={statusColors[status] || "bg-gray-100"} variant="secondary">
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "kycStatus",
      header: "KYC",
      cell: ({ row }) => {
        const kycStatus = row.getValue("kycStatus") as string;
        return (
          <Badge className={kycColors[kycStatus] || "bg-gray-100"} variant="secondary">
            {kycStatus.replace("_", " ")}
          </Badge>
        );
      },
    },
    {
      accessorKey: "walletBalance",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Balance
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const balance = row.getValue("walletBalance") as number;
        return <div className="font-medium">{formatCurrency(balance)}</div>;
      },
    },
    {
      accessorKey: "transactionCount",
      header: "Transactions",
      cell: ({ row }) => {
        const count = row.getValue("transactionCount") as number;
        return <div>{count.toLocaleString()}</div>;
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.getValue("createdAt"));
        return date.toLocaleDateString();
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const user = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.id)}>
                Copy User ID
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActionDialog({ open: true, type: "role", user })}>
                <Shield className="mr-2 h-4 w-4" />
                Change Role
              </DropdownMenuItem>
              {user.status === "ACTIVE" ? (
                <DropdownMenuItem
                  className="text-orange-600"
                  onClick={() => handleUpdateUser(user.id, { status: "SUSPENDED" })}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend User
                </DropdownMenuItem>
              ) : user.status === "SUSPENDED" ? (
                <DropdownMenuItem
                  className="text-green-600"
                  onClick={() => handleUpdateUser(user.id, { status: "ACTIVE" })}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Reactivate User
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-destructive">{error}</p>
          <Button onClick={fetchUsers} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage all platform users and their permissions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Filters:</span>
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="USER">User</SelectItem>
            <SelectItem value="VENDOR">Vendor</SelectItem>
            <SelectItem value="ADMIN">Admin</SelectItem>
            <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        {(roleFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRoleFilter("all");
              setStatusFilter("all");
            }}
          >
            Clear filters
          </Button>
        )}
        <div className="ml-auto text-sm text-muted-foreground">
          {pagination.total} users
        </div>
      </div>

      <DataTable
        columns={columns}
        data={users}
        searchKey="displayName"
        searchPlaceholder="Search users..."
      />

      {/* Change Role Dialog */}
      <Dialog
        open={actionDialog.open && actionDialog.type === "role"}
        onOpenChange={(open) => !open && setActionDialog({ open: false, type: null, user: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Change the role for {actionDialog.user?.displayName || actionDialog.user?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>New Role</Label>
            <Select
              onValueChange={(value) => {
                if (actionDialog.user) {
                  handleUpdateUser(actionDialog.user.id, { role: value });
                }
              }}
            >
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="VENDOR">Vendor</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog({ open: false, type: null, user: null })}
              disabled={actionLoading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
