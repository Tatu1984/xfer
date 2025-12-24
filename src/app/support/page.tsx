"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  MessageSquare,
  Phone,
  Mail,
  FileText,
  CreditCard,
  Shield,
  User,
  Settings,
  HelpCircle,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const categories = [
  {
    icon: CreditCard,
    title: "Payments & Transfers",
    description: "Send money, receive payments, and manage transactions",
    articles: 24,
  },
  {
    icon: User,
    title: "Account Management",
    description: "Profile settings, verification, and account security",
    articles: 18,
  },
  {
    icon: Shield,
    title: "Security & Privacy",
    description: "Protect your account and understand our policies",
    articles: 15,
  },
  {
    icon: Settings,
    title: "Technical Support",
    description: "Troubleshooting, integrations, and API help",
    articles: 21,
  },
];

const popularArticles = [
  { title: "How to send money to friends and family", views: "12.5k" },
  { title: "Setting up two-factor authentication", views: "8.2k" },
  { title: "Understanding transaction fees", views: "7.8k" },
  { title: "How to link a bank account", views: "6.9k" },
  { title: "Disputing a transaction", views: "5.4k" },
  { title: "Account verification requirements", views: "4.8k" },
];

const faqItems = [
  {
    question: "How long do transfers take?",
    answer: "Instant transfers between Xfer accounts are immediate. Bank transfers typically take 1-3 business days, depending on your bank. International transfers may take 3-5 business days.",
  },
  {
    question: "What are the transfer limits?",
    answer: "Personal accounts can send up to $10,000 per transaction and $50,000 per month. Verified business accounts have higher limits. Contact support to request limit increases.",
  },
  {
    question: "How do I get a refund?",
    answer: "If you need a refund for a purchase, contact the seller first. If the seller is unresponsive, you can open a dispute through your transaction history within 180 days of the payment.",
  },
  {
    question: "Is my money protected?",
    answer: "Yes, funds in your Xfer account are held in partner banks and are eligible for FDIC insurance up to $250,000. We also offer Buyer Protection for eligible purchases.",
  },
  {
    question: "How do I verify my identity?",
    answer: "Go to Settings > Security > Verify Identity. You'll need to provide a government-issued ID and complete our verification process. This usually takes 1-2 business days.",
  },
];

export default function SupportPage() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-primary/5 border-b">
        <div className="container max-w-4xl py-16 text-center">
          <h1 className="text-4xl font-bold mb-4">How can we help you?</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Search our knowledge base or browse categories below
          </p>
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search for help articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
        </div>
      </div>

      <div className="container max-w-6xl py-12">
        {/* Quick Contact */}
        <div className="grid gap-4 md:grid-cols-3 mb-12">
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Live Chat</h3>
                <p className="text-sm text-muted-foreground">Available 24/7</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Phone Support</h3>
                <p className="text-sm text-muted-foreground">1-800-XFER-HELP</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:border-primary transition-colors">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Email Support</h3>
                <p className="text-sm text-muted-foreground">support@xfer.app</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Browse by Category</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <Card key={category.title} className="cursor-pointer hover:border-primary transition-colors">
                <CardContent className="pt-6">
                  <category.icon className="h-8 w-8 mb-3 text-primary" />
                  <h3 className="font-semibold mb-1">{category.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {category.description}
                  </p>
                  <Badge variant="secondary">{category.articles} articles</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Popular Articles */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Popular Articles</h2>
            <Card>
              <CardContent className="pt-6 space-y-4">
                {popularArticles.map((article, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span>{article.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{article.views} views</Badge>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* FAQ */}
          <section>
            <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
            <Card>
              <CardContent className="pt-6">
                <Accordion type="single" collapsible>
                  {faqItems.map((item, index) => (
                    <AccordionItem key={index} value={`item-${index}`}>
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* Resources */}
        <section className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Additional Resources</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Developer Documentation</CardTitle>
                <CardDescription>API guides and integration help</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  View Docs
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Community Forum</CardTitle>
                <CardDescription>Connect with other users</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Join Community
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">System Status</CardTitle>
                <CardDescription>Check service availability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-green-600">All Systems Operational</span>
                </div>
                <Button variant="outline" className="w-full">
                  View Status
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="mt-12">
          <Card className="bg-primary/5">
            <CardContent className="pt-6 text-center">
              <HelpCircle className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h3 className="text-xl font-semibold mb-2">Still need help?</h3>
              <p className="text-muted-foreground mb-4">
                Can't find what you're looking for? Our support team is here to help.
              </p>
              <div className="flex gap-4 justify-center">
                <Button>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Start Live Chat
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/contact">Contact Us</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
