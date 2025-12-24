"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, Save, Upload } from "lucide-react";

export default function VendorBusinessPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Profile</h1>
          <p className="text-muted-foreground">
            Manage your business information
          </p>
        </div>
        <Badge variant="default">KYB Verified</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
            <CardDescription>Your business details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="legal-name">Legal Business Name</Label>
              <Input id="legal-name" defaultValue="Tech Solutions Inc" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trading-name">Trading Name (DBA)</Label>
              <Input id="trading-name" defaultValue="TechSol" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registration">Registration Number</Label>
              <Input id="registration" defaultValue="123456789" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-id">Tax ID / EIN</Label>
              <Input id="tax-id" defaultValue="XX-XXXXXXX" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" defaultValue="Technology / Software" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" defaultValue="https://techsolutions.com" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Address</CardTitle>
            <CardDescription>Your registered business address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address1">Address Line 1</Label>
              <Input id="address1" defaultValue="123 Business Street" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">Address Line 2</Label>
              <Input id="address2" defaultValue="Suite 100" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" defaultValue="San Francisco" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" defaultValue="CA" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP Code</Label>
                <Input id="zip" defaultValue="94102" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input id="country" defaultValue="United States" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Business Description</CardTitle>
            <CardDescription>Describe your business and services</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                defaultValue="We provide innovative technology solutions for businesses of all sizes. Our services include software development, IT consulting, and cloud infrastructure management."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Business Documents</CardTitle>
            <CardDescription>Upload required business documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Business Registration</span>
                  <Badge variant="outline">Verified</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Certificate of incorporation or business license
                </p>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Update
                </Button>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Tax Document</span>
                  <Badge variant="outline">Verified</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  IRS form or tax registration certificate
                </p>
                <Button variant="outline" size="sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Update
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div className="flex justify-end">
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
