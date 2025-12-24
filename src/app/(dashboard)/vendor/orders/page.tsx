"use client";

import { useState, useEffect } from "react";
import {
  Package,
  Search,
  Filter,
  Eye,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  Truck,
  Download,
  RefreshCw,
  AlertCircle,
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  tax: number;
  currency: string;
  customerEmail: string | null;
  shippingAddress: {
    line1?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  } | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  AUTHORIZED: { label: "Authorized", color: "bg-blue-100 text-blue-800", icon: CheckCircle },
  CAPTURED: { label: "Captured", color: "bg-green-100 text-green-800", icon: CheckCircle },
  PROCESSING: { label: "Processing", color: "bg-blue-100 text-blue-800", icon: Package },
  SHIPPED: { label: "Shipped", color: "bg-purple-100 text-purple-800", icon: Truck },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-800", icon: CheckCircle },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
  REFUNDED: { label: "Refunded", color: "bg-gray-100 text-gray-800", icon: XCircle },
};

function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: "20",
      });
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);

      const response = await fetch(`/api/vendor/orders?${params}`);
      if (!response.ok) throw new Error("Failed to fetch orders");

      const data: OrdersResponse = await response.json();
      setOrders(data.orders);
      setPagination(prev => ({
        ...prev,
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, pagination.page]);

  const handleUpdateOrder = async (newStatus: string) => {
    if (!selectedOrder) return;

    setActionLoading(true);
    try {
      const response = await fetch(`/api/vendor/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          trackingNumber: trackingNumber || undefined,
          notes: orderNotes || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update order");
      }

      setUpdateDialogOpen(false);
      setDetailDialogOpen(false);
      setSelectedOrder(null);
      setTrackingNumber("");
      setOrderNotes("");
      fetchOrders();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update order");
    } finally {
      setActionLoading(false);
    }
  };

  const openOrderDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailDialogOpen(true);
  };

  const openUpdateDialog = () => {
    if (selectedOrder) {
      setTrackingNumber(selectedOrder.trackingNumber || "");
      setOrderNotes(selectedOrder.notes || "");
      setUpdateDialogOpen(true);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Calculate stats
  const pendingOrders = orders.filter(o => o.status === "PENDING" || o.status === "AUTHORIZED").length;
  const processingOrders = orders.filter(o => o.status === "PROCESSING" || o.status === "SHIPPED").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Manage and fulfill customer orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingOrders}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{processingOrders}</p>
                <p className="text-sm text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {orders.filter(o => o.status === "COMPLETED" || o.status === "DELIVERED").length}
                </p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                <Package className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pagination.total}</p>
                <p className="text-sm text-muted-foreground">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by order number or email..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchOrders()}
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="AUTHORIZED">Authorized</SelectItem>
                <SelectItem value="CAPTURED">Captured</SelectItem>
                <SelectItem value="PROCESSING">Processing</SelectItem>
                <SelectItem value="SHIPPED">Shipped</SelectItem>
                <SelectItem value="DELIVERED">Delivered</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length > 0 ? (
                orders.map((order) => {
                  const status = statusConfig[order.status] || statusConfig.PENDING;
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell>
                        {order.customerEmail || "Guest"}
                      </TableCell>
                      <TableCell>
                        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(order.total, order.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openOrderDetail(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No orders found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Order Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          {selectedOrder && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Order {selectedOrder.orderNumber}
                  <Badge className={statusConfig[selectedOrder.status]?.color || "bg-gray-100"}>
                    {statusConfig[selectedOrder.status]?.label || selectedOrder.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Placed on {formatDate(selectedOrder.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Customer Info */}
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedOrder.customerEmail || "Guest checkout"}</p>
                </div>

                {/* Shipping Address */}
                {selectedOrder.shippingAddress && (
                  <div>
                    <Label className="text-muted-foreground">Shipping Address</Label>
                    <p className="font-medium">
                      {selectedOrder.shippingAddress.line1}
                      {selectedOrder.shippingAddress.city && `, ${selectedOrder.shippingAddress.city}`}
                      {selectedOrder.shippingAddress.state && `, ${selectedOrder.shippingAddress.state}`}
                      {selectedOrder.shippingAddress.postalCode && ` ${selectedOrder.shippingAddress.postalCode}`}
                      {selectedOrder.shippingAddress.country && `, ${selectedOrder.shippingAddress.country}`}
                    </p>
                  </div>
                )}

                {/* Tracking */}
                {selectedOrder.trackingNumber && (
                  <div>
                    <Label className="text-muted-foreground">Tracking Number</Label>
                    <p className="font-mono">{selectedOrder.trackingNumber}</p>
                  </div>
                )}

                {/* Order Items */}
                <div>
                  <Label className="text-muted-foreground mb-2 block">Items</Label>
                  <div className="border rounded-lg divide-y">
                    {selectedOrder.items.map((item) => (
                      <div key={item.id} className="p-3 flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatCurrency(item.unitPrice, selectedOrder.currency)} x {item.quantity}
                          </p>
                        </div>
                        <p className="font-medium">
                          {formatCurrency(item.totalPrice, selectedOrder.currency)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedOrder.subtotal, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(selectedOrder.tax, selectedOrder.currency)}</span>
                  </div>
                  <div className="flex justify-between font-medium text-lg pt-2 border-t">
                    <span>Total</span>
                    <span>{formatCurrency(selectedOrder.total, selectedOrder.currency)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div>
                    <Label className="text-muted-foreground">Notes</Label>
                    <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                  Close
                </Button>
                {(selectedOrder.status === "CAPTURED" || selectedOrder.status === "PROCESSING") && (
                  <Button onClick={openUpdateDialog}>
                    <Truck className="mr-2 h-4 w-4" />
                    Update Status
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Order Status</DialogTitle>
            <DialogDescription>
              Update the status and add tracking information for order {selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tracking Number</Label>
              <Input
                placeholder="Enter tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add notes about this order..."
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setUpdateDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            {selectedOrder?.status === "CAPTURED" && (
              <Button
                onClick={() => handleUpdateOrder("PROCESSING")}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Package className="mr-2 h-4 w-4" />
                )}
                Mark Processing
              </Button>
            )}
            {(selectedOrder?.status === "PROCESSING" || selectedOrder?.status === "CAPTURED") && (
              <Button
                onClick={() => handleUpdateOrder("SHIPPED")}
                disabled={actionLoading || !trackingNumber}
              >
                {actionLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Truck className="mr-2 h-4 w-4" />
                )}
                Mark Shipped
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
