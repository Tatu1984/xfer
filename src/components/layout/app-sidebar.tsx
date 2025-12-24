"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  ArrowLeftRight,
  FileText,
  AlertTriangle,
  Shield,
  Settings,
  HelpCircle,
  LogOut,
  Building2,
  Wallet,
  Send,
  Receipt,
  BarChart3,
  Bell,
  UserCheck,
  Scale,
  History,
  Store,
  Package,
  Tags,
  ShoppingCart,
  ClipboardList,
  BadgeDollarSign,
  ArrowRightLeft,
  Smartphone,
  Key,
  Webhook,
  FlaskConical,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@prisma/client";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const superAdminNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
      { title: "Analytics", href: "/super-admin/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "User Management",
    items: [
      { title: "All Users", href: "/super-admin/users", icon: Users },
      { title: "Admins", href: "/super-admin/users/admins", icon: Shield },
      { title: "Vendors", href: "/super-admin/users/vendors", icon: Store },
      { title: "KYC Queue", href: "/super-admin/kyc", icon: UserCheck, badge: 12 },
    ],
  },
  {
    label: "Financial",
    items: [
      { title: "Transactions", href: "/super-admin/transactions", icon: ArrowLeftRight },
      { title: "Settlements", href: "/super-admin/settlements", icon: BadgeDollarSign },
      { title: "Payouts", href: "/super-admin/payouts", icon: Send },
    ],
  },
  {
    label: "Risk & Compliance",
    items: [
      { title: "Risk Rules", href: "/super-admin/risk-rules", icon: AlertTriangle },
      { title: "Compliance Alerts", href: "/super-admin/compliance", icon: Scale, badge: 5 },
      { title: "Disputes", href: "/super-admin/disputes", icon: FileText, badge: 8 },
    ],
  },
  {
    label: "System",
    items: [
      { title: "System Settings", href: "/super-admin/settings", icon: Settings },
      { title: "Activity Logs", href: "/super-admin/logs", icon: History },
      { title: "Notifications", href: "/super-admin/notifications", icon: Bell },
    ],
  },
];

const adminNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/admin", icon: LayoutDashboard },
    ],
  },
  {
    label: "User Management",
    items: [
      { title: "Users", href: "/admin/users", icon: Users },
      { title: "Vendors", href: "/admin/vendors", icon: Store },
      { title: "KYC Review", href: "/admin/kyc", icon: UserCheck, badge: 8 },
    ],
  },
  {
    label: "Financial",
    items: [
      { title: "Transactions", href: "/admin/transactions", icon: ArrowLeftRight },
      { title: "Disputes", href: "/admin/disputes", icon: FileText, badge: 3 },
    ],
  },
  {
    label: "Compliance",
    items: [
      { title: "Alerts", href: "/admin/compliance", icon: AlertTriangle, badge: 2 },
      { title: "Reports", href: "/admin/reports", icon: ClipboardList },
    ],
  },
  {
    label: "Support",
    items: [
      { title: "Tickets", href: "/admin/tickets", icon: HelpCircle, badge: 15 },
    ],
  },
];

const vendorNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/vendor", icon: LayoutDashboard },
      { title: "Analytics", href: "/vendor/analytics", icon: BarChart3 },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Balance", href: "/vendor/balance", icon: Wallet },
      { title: "Transactions", href: "/vendor/transactions", icon: ArrowLeftRight },
      { title: "Payouts", href: "/vendor/payouts", icon: Send },
    ],
  },
  {
    label: "Business",
    items: [
      { title: "Orders", href: "/vendor/orders", icon: ShoppingCart },
      { title: "Products", href: "/vendor/products", icon: Package },
      { title: "Customers", href: "/vendor/customers", icon: Users },
      { title: "Invoices", href: "/vendor/invoices", icon: Receipt },
    ],
  },
  {
    label: "Subscriptions",
    items: [
      { title: "Plans", href: "/vendor/plans", icon: Tags },
      { title: "Subscribers", href: "/vendor/subscribers", icon: Users },
    ],
  },
  {
    label: "Developer",
    items: [
      { title: "API Keys", href: "/vendor/api-keys", icon: Key },
      { title: "Webhooks", href: "/vendor/webhooks", icon: Webhook },
      { title: "Sandbox", href: "/vendor/sandbox", icon: FlaskConical },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Business Profile", href: "/vendor/business", icon: Building2 },
      { title: "Settings", href: "/vendor/settings", icon: Settings },
    ],
  },
];

const userNav: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Wallet", href: "/dashboard/wallet", icon: Wallet },
      { title: "Send Money", href: "/dashboard/send", icon: Send },
      { title: "Request Money", href: "/dashboard/request", icon: Receipt },
      { title: "Convert", href: "/dashboard/convert", icon: ArrowRightLeft },
      { title: "Transactions", href: "/dashboard/transactions", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Payment Methods",
    items: [
      { title: "Cards & Banks", href: "/dashboard/payment-methods", icon: CreditCard },
    ],
  },
  {
    label: "Security",
    items: [
      { title: "Security Settings", href: "/dashboard/security", icon: Shield },
      { title: "Devices", href: "/dashboard/devices", icon: Smartphone },
      { title: "Verify Identity", href: "/dashboard/kyc", icon: UserCheck },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/dashboard/profile", icon: Users },
      { title: "Disputes", href: "/dashboard/disputes", icon: FileText },
      { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
      { title: "Settings", href: "/dashboard/settings", icon: Settings },
      { title: "Help", href: "/dashboard/help", icon: HelpCircle },
    ],
  },
];

const getNavForRole = (role: Role): NavGroup[] => {
  switch (role) {
    case "SUPER_ADMIN":
      return superAdminNav;
    case "ADMIN":
      return adminNav;
    case "VENDOR":
      return vendorNav;
    case "USER":
    default:
      return userNav;
  }
};

interface AppSidebarProps {
  user: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
    role: Role;
  };
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const navigation = getNavForRole(user.role);

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || user.email[0].toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            X
          </div>
          <span className="font-semibold text-lg">Xfer</span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-3">
        {navigation.map((group, groupIndex) => (
          <SidebarGroup key={groupIndex}>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          <span className="flex-1">{item.title}</span>
                          {item.badge && (
                            <Badge
                              variant={isActive ? "secondary" : "destructive"}
                              className="ml-auto h-5 min-w-[20px] px-1.5"
                            >
                              {item.badge}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors">
              <Avatar className="h-9 w-9">
                <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium leading-none">{user.name || "User"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/support">
                <HelpCircle className="mr-2 h-4 w-4" />
                Support
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/auth/login" })}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
