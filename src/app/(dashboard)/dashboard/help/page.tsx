"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HelpCircle,
  Search,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Shield,
  Send,
  ExternalLink,
} from "lucide-react";

const faqItems = [
  {
    category: "Payments",
    questions: [
      {
        q: "How do I send money to someone?",
        a: "To send money, go to your Dashboard and click 'Send Money'. Enter the recipient's email address or phone number, the amount you want to send, and click Send. The money will be transferred instantly if the recipient has an Xfer account.",
      },
      {
        q: "What payment methods are supported?",
        a: "We support bank accounts, debit cards, and credit cards. You can link multiple payment methods to your account and choose which one to use for each transaction.",
      },
      {
        q: "Are there any fees for sending money?",
        a: "Sending money to friends and family using your Xfer balance or bank account is free. There's a small fee (2.9% + $0.30) when using a credit card or for business transactions.",
      },
    ],
  },
  {
    category: "Account",
    questions: [
      {
        q: "How do I verify my account?",
        a: "To verify your account, go to Settings > Security and click 'Verify Identity'. You'll need to provide a government-issued ID and complete the verification process. This usually takes 1-2 business days.",
      },
      {
        q: "Can I have multiple accounts?",
        a: "No, each person can only have one personal Xfer account. However, you can also create a separate business account if you're a merchant or vendor.",
      },
      {
        q: "How do I close my account?",
        a: "To close your account, please contact our support team. Make sure to withdraw any remaining balance before requesting account closure.",
      },
    ],
  },
  {
    category: "Security",
    questions: [
      {
        q: "How do I enable two-factor authentication?",
        a: "Go to Settings > Security and toggle on 'Two-Factor Authentication'. You can choose to receive codes via SMS or use an authenticator app like Google Authenticator.",
      },
      {
        q: "What should I do if I suspect unauthorized activity?",
        a: "If you notice any suspicious activity, immediately change your password and contact our support team. We'll help you secure your account and investigate any unauthorized transactions.",
      },
      {
        q: "Is my financial information secure?",
        a: "Yes, we use bank-level encryption (256-bit SSL) to protect your data. We're also PCI-DSS compliant and never store your full card numbers on our servers.",
      },
    ],
  },
];

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Help Center</h1>
        <p className="text-muted-foreground">
          Find answers and get support
        </p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 text-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Payments</div>
            <p className="text-sm text-muted-foreground">Send & receive money</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Security</div>
            <p className="text-sm text-muted-foreground">Protect your account</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Account</div>
            <p className="text-sm text-muted-foreground">Manage settings</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <CardContent className="pt-6 text-center">
            <HelpCircle className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">General</div>
            <p className="text-sm text-muted-foreground">Common questions</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* FAQ Section */}
        <div className="md:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold">Frequently Asked Questions</h2>
          {faqItems.map((category) => (
            <Card key={category.category}>
              <CardHeader>
                <CardTitle className="text-lg">{category.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible>
                  {category.questions.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {item.q}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Contact & Support */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Contact Support</h2>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Live Chat
              </CardTitle>
              <CardDescription>Chat with our support team</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Available 24/7 for urgent issues
              </p>
              <Button className="w-full">
                Start Chat
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Phone className="h-5 w-5" />
                Phone Support
              </CardTitle>
              <CardDescription>Talk to a representative</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-medium">1-800-XFER-HELP</p>
              <p className="text-sm text-muted-foreground">
                Mon-Fri, 9AM - 6PM EST
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" />
                Email Support
              </CardTitle>
              <CardDescription>Send us a message</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment">Payment Issue</SelectItem>
                    <SelectItem value="account">Account Problem</SelectItem>
                    <SelectItem value="security">Security Concern</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea
                  id="message"
                  placeholder="Describe your issue..."
                  rows={4}
                />
              </div>
              <Button className="w-full">
                <Send className="mr-2 h-4 w-4" />
                Send Message
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                User Guide
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <Shield className="mr-2 h-4 w-4" />
                Security Center
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-start">
                <FileText className="mr-2 h-4 w-4" />
                API Documentation
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
