"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Plus, FileText, Send, MoreHorizontal, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerEmail: string;
  customerName: string | null;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  currency: string;
  dueDate: string | null;
  items: InvoiceItem[];
  createdAt: string;
}

interface InvoiceFormData {
  customerEmail: string;
  customerName: string;
  dueDate: string;
  notes: string;
  items: InvoiceItem[];
}

const defaultFormData: InvoiceFormData = {
  customerEmail: "",
  customerName: "",
  dueDate: "",
  notes: "",
  items: [{ description: "", quantity: 1, unitPrice: 0, amount: 0 }],
};

export default function VendorInvoicesPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>(defaultFormData);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/vendor/invoices");
      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices);
      } else {
        toast({
          title: "Error",
          description: "Failed to load invoices",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvoice = async () => {
    if (!formData.customerEmail) {
      toast({
        title: "Error",
        description: "Customer email is required",
        variant: "destructive",
      });
      return;
    }

    const validItems = formData.items.filter((item) => item.description && item.unitPrice > 0);
    if (validItems.length === 0) {
      toast({
        title: "Error",
        description: "At least one line item is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/vendor/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          items: validItems.map((item) => ({
            ...item,
            amount: item.quantity * item.unitPrice,
          })),
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Success",
          description: "Invoice created successfully",
        });
        setDialogOpen(false);
        setFormData(defaultFormData);
        fetchInvoices();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create invoice",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (id: string, action: "send" | "mark_paid" | "cancel") => {
    setSaving(true);
    try {
      const response = await fetch("/api/vendor/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });

      const result = await response.json();

      if (response.ok) {
        const actionMessages = {
          send: "Invoice sent successfully",
          mark_paid: "Invoice marked as paid",
          cancel: "Invoice cancelled",
        };
        toast({
          title: "Success",
          description: actionMessages[action],
        });
        fetchInvoices();
      } else {
        toast({
          title: "Error",
          description: result.error || "Action failed",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Action failed",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: "", quantity: 1, unitPrice: 0, amount: 0 }],
    });
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].amount = newItems[index].quantity * newItems[index].unitPrice;
    }
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems.length > 0 ? newItems : defaultFormData.items });
  };

  const filteredInvoices = invoices.filter(
    (invoice) =>
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      invoice.customerEmail.toLowerCase().includes(search.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  };

  const paidAmount = invoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + Number(i.total), 0);
  const pendingAmount = invoices.filter((i) => i.status === "SENT" || i.status === "VIEWED").reduce((sum, i) => sum + Number(i.total), 0);
  const overdueAmount = invoices.filter((i) => i.status === "OVERDUE").reduce((sum, i) => sum + Number(i.total), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage invoices
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Invoice
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
            <FileText className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(paidAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(pendingAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <FileText className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(overdueAmount)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>Manage your invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search invoices..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold">No invoices found</h3>
              <p className="text-muted-foreground">
                {search ? "Try adjusting your search" : "Create your first invoice to get started"}
              </p>
              {!search && (
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.customerEmail}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(Number(invoice.total))}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(invoice.dueDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === "PAID"
                            ? "default"
                            : invoice.status === "SENT" || invoice.status === "VIEWED"
                            ? "secondary"
                            : invoice.status === "OVERDUE"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {invoice.status === "DRAFT" && (
                            <DropdownMenuItem onClick={() => handleAction(invoice.id, "send")}>
                              <Send className="mr-2 h-4 w-4" />
                              Send Invoice
                            </DropdownMenuItem>
                          )}
                          {(invoice.status === "SENT" || invoice.status === "VIEWED" || invoice.status === "OVERDUE") && (
                            <DropdownMenuItem onClick={() => handleAction(invoice.id, "mark_paid")}>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Mark as Paid
                            </DropdownMenuItem>
                          )}
                          {invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleAction(invoice.id, "cancel")}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
            <DialogDescription>
              Create a new invoice for your customer
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customerEmail">Customer Email *</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  placeholder="customer@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-4">
              <Label>Line Items</Label>
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, "quantity", Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-3">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, "unitPrice", Number(e.target.value))}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</span>
                    {formData.items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeItem(index)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes for the customer..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
