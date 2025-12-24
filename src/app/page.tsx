import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Shield,
  CreditCard,
  Globe,
  Zap,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

export default async function Home() {
  const session = await auth();

  // If user is authenticated, redirect to their dashboard
  if (session?.user) {
    switch (session.user.role) {
      case "SUPER_ADMIN":
        redirect("/super-admin");
      case "ADMIN":
        redirect("/admin");
      case "VENDOR":
        redirect("/vendor");
      default:
        redirect("/dashboard");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold">
              X
            </div>
            <span className="font-semibold text-xl">Xfer</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold tracking-tight mb-6">
            The Modern Payment Platform for Everyone
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Send money, receive payments, and manage your finances with our secure,
            fast, and easy-to-use payment platform.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/auth/register">
              <Button size="lg" className="gap-2">
                Create Free Account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/auth/register?type=business">
              <Button size="lg" variant="outline">
                Business Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">
            Everything You Need for Digital Payments
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A complete suite of tools for personal and business payments
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-6 rounded-xl border bg-white dark:bg-slate-800">
            <div className="h-12 w-12 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Instant Transfers</h3>
            <p className="text-sm text-muted-foreground">
              Send and receive money instantly to anyone, anywhere in the world.
            </p>
          </div>

          <div className="p-6 rounded-xl border bg-white dark:bg-slate-800">
            <div className="h-12 w-12 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Bank-Level Security</h3>
            <p className="text-sm text-muted-foreground">
              Your data is protected with advanced encryption and fraud detection.
            </p>
          </div>

          <div className="p-6 rounded-xl border bg-white dark:bg-slate-800">
            <div className="h-12 w-12 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-4">
              <Globe className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Multi-Currency</h3>
            <p className="text-sm text-muted-foreground">
              Hold and convert between multiple currencies with competitive rates.
            </p>
          </div>

          <div className="p-6 rounded-xl border bg-white dark:bg-slate-800">
            <div className="h-12 w-12 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center mb-4">
              <CreditCard className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Multiple Payment Methods</h3>
            <p className="text-sm text-muted-foreground">
              Link bank accounts, debit cards, and credit cards seamlessly.
            </p>
          </div>
        </div>
      </section>

      {/* For Business Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto rounded-2xl bg-primary p-12 text-primary-foreground">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-4">
                Built for Businesses of All Sizes
              </h2>
              <p className="opacity-90 mb-6">
                Accept payments online, manage subscriptions, send payouts,
                and grow your business with our merchant tools.
              </p>
              <ul className="space-y-3 mb-6">
                {[
                  "Easy checkout integration",
                  "Subscription management",
                  "Real-time analytics",
                  "Mass payouts",
                  "Invoicing tools",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?type=business">
                <Button variant="secondary" size="lg">
                  Open Business Account
                </Button>
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="aspect-square rounded-xl bg-white/10 flex items-center justify-center">
                <div className="text-6xl font-bold opacity-20">
                  Business
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl font-bold mb-4">
          Ready to Get Started?
        </h2>
        <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
          Join millions of users who trust our platform for their payments.
          Create your free account in minutes.
        </p>
        <Link href="/auth/register">
          <Button size="lg" className="gap-2">
            Create Your Account
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                X
              </div>
              <span className="text-sm text-muted-foreground">
                Xfer - Secure Payment Platform
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/terms" className="hover:text-foreground">
                Terms
              </Link>
              <Link href="/privacy" className="hover:text-foreground">
                Privacy
              </Link>
              <Link href="/security" className="hover:text-foreground">
                Security
              </Link>
              <Link href="/contact" className="hover:text-foreground">
                Contact
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
