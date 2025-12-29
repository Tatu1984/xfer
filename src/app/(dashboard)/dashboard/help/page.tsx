"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Loader2,
  Bot,
  User,
} from "lucide-react";
import { toast } from "sonner";

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

// Sandbox chat responses
const chatResponses: Record<string, string> = {
  "hello": "Hello! Welcome to Xfer Support. How can I help you today?",
  "hi": "Hi there! I'm here to help. What can I assist you with?",
  "help": "I can help you with payments, account issues, security questions, and more. What would you like to know?",
  "payment": "For payment issues, I can help with: sending money, receiving money, payment methods, and transaction status. What specific issue are you facing?",
  "send money": "To send money: 1) Go to Dashboard, 2) Click 'Send Money', 3) Enter recipient's email, 4) Enter amount, 5) Click Send. Is there anything else?",
  "fee": "Our fees: Personal transfers from balance are FREE. Credit card payments have a 2.9% + $0.30 fee. Business transactions may have additional fees.",
  "verify": "To verify your account: Go to Settings > Security > Verify Identity. You'll need a government ID and it takes 1-2 business days.",
  "security": "For security concerns, I recommend: 1) Enable 2FA, 2) Use a strong password, 3) Never share your login details. Would you like me to guide you through any of these?",
  "password": "To change your password: Go to Settings > Security > Change Password. Make sure to use a strong, unique password.",
  "default": "I understand you need help with that. For complex issues, I recommend using our email support or calling 1-800-XFER-HELP. Is there anything else I can help with?",
};

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ text: string; isBot: boolean }[]>([
    { text: "Hello! Welcome to Xfer Support. How can I help you today?", isBot: true },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;

    const userMessage = chatInput.toLowerCase().trim();
    setChatMessages(prev => [...prev, { text: chatInput, isBot: false }]);
    setChatInput("");

    // Simulate bot response
    setTimeout(() => {
      let response = chatResponses.default;
      for (const [key, value] of Object.entries(chatResponses)) {
        if (userMessage.includes(key)) {
          response = value;
          break;
        }
      }
      setChatMessages(prev => [...prev, { text: response, isBot: true }]);
    }, 500);
  };

  const handleSendEmail = async () => {
    if (!emailSubject || !emailMessage.trim()) {
      toast.error("Please select a subject and enter a message");
      return;
    }

    setSendingEmail(true);
    try {
      // Sandbox: simulate email sending
      await new Promise(resolve => setTimeout(resolve, 1000));

      // In production, this would call: POST /api/support/email
      toast.success("Message sent! We'll respond within 24 hours.");
      setEmailSubject("");
      setEmailMessage("");
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  };

  const openResource = (resource: string) => {
    const urls: Record<string, string> = {
      "user-guide": "/docs/user-guide",
      "security": "/docs/security",
      "api": "/docs/api",
    };

    // Sandbox: show toast for external resources
    toast.success(`Opening ${resource}...`);
    // In production: window.open(urls[resource], "_blank");
  };

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
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setChatOpen(true)}>
          <CardContent className="pt-6 text-center">
            <CreditCard className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Payments</div>
            <p className="text-sm text-muted-foreground">Send & receive money</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setChatOpen(true)}>
          <CardContent className="pt-6 text-center">
            <Shield className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Security</div>
            <p className="text-sm text-muted-foreground">Protect your account</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setChatOpen(true)}>
          <CardContent className="pt-6 text-center">
            <FileText className="h-8 w-8 mx-auto mb-2 text-primary" />
            <div className="font-medium">Account</div>
            <p className="text-sm text-muted-foreground">Manage settings</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => setChatOpen(true)}>
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
              <Button className="w-full" onClick={() => setChatOpen(true)}>
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
                <Select value={emailSubject} onValueChange={setEmailSubject}>
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
                  value={emailMessage}
                  onChange={(e) => setEmailMessage(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleSendEmail} disabled={sendingEmail}>
                {sendingEmail ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send Message
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="ghost" className="w-full justify-start" onClick={() => openResource("user-guide")}>
                <FileText className="mr-2 h-4 w-4" />
                User Guide
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => openResource("security")}>
                <Shield className="mr-2 h-4 w-4" />
                Security Center
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => openResource("api")}>
                <FileText className="mr-2 h-4 w-4" />
                API Documentation
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Live Chat Dialog */}
      <Dialog open={chatOpen} onOpenChange={setChatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Live Support Chat
            </DialogTitle>
            <DialogDescription>
              Chat with our AI assistant or wait for a human agent
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="h-[300px] overflow-y-auto border rounded-lg p-4 space-y-3">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 ${msg.isBot ? "" : "flex-row-reverse"}`}
                >
                  <div className={`p-1 rounded-full ${msg.isBot ? "bg-primary/10" : "bg-muted"}`}>
                    {msg.isBot ? (
                      <Bot className="h-4 w-4 text-primary" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`max-w-[80%] p-3 rounded-lg text-sm ${
                      msg.isBot ? "bg-muted" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
              />
              <Button onClick={handleSendChat}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
