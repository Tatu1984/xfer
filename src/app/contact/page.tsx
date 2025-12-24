"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Phone, MapPin, Clock, Send, MessageSquare, HelpCircle } from "lucide-react";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log(formData);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have questions or need assistance? We're here to help.
            Choose the best way to reach us.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 mb-12">
          <Card>
            <CardContent className="pt-6 text-center">
              <Mail className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Email Us</h3>
              <p className="text-muted-foreground mb-2">General inquiries</p>
              <a href="mailto:support@xfer.app" className="text-primary hover:underline">
                support@xfer.app
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <Phone className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Call Us</h3>
              <p className="text-muted-foreground mb-2">24/7 support line</p>
              <a href="tel:1-800-XFER-HELP" className="text-primary hover:underline">
                1-800-XFER-HELP
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <MessageSquare className="h-10 w-10 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-semibold mb-2">Live Chat</h3>
              <p className="text-muted-foreground mb-2">Instant support</p>
              <Button variant="link" className="p-0">
                Start Chat
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Send us a Message</CardTitle>
              <CardDescription>
                Fill out the form below and we'll get back to you within 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      placeholder="Your name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Select
                    value={formData.subject}
                    onValueChange={(value) => setFormData({ ...formData, subject: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Inquiry</SelectItem>
                      <SelectItem value="support">Technical Support</SelectItem>
                      <SelectItem value="billing">Billing Question</SelectItem>
                      <SelectItem value="partnership">Partnership Inquiry</SelectItem>
                      <SelectItem value="press">Press & Media</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="How can we help you?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Office Locations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-1">Headquarters</h4>
                  <p className="text-muted-foreground">
                    123 Financial Street<br />
                    San Francisco, CA 94102<br />
                    United States
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">European Office</h4>
                  <p className="text-muted-foreground">
                    45 Fintech Square<br />
                    London, EC2A 4NE<br />
                    United Kingdom
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Asia Pacific</h4>
                  <p className="text-muted-foreground">
                    88 Marina Boulevard<br />
                    Singapore 018984
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Support Hours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone Support</span>
                  <span>24/7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Live Chat</span>
                  <span>24/7</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email Response</span>
                  <span>Within 24 hours</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Quick Links
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="ghost" className="w-full justify-start">
                  Help Center
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  FAQ
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Developer Documentation
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  System Status
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
