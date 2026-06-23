import {
  BarChart3,
  Bell,
  Boxes,
  CircleHelp,
  LayoutDashboard,
  Package,
  Settings,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import type { SellerNavItem } from "../types/seller-onboarding.types";

export const sellerSidebarItems: SellerNavItem[] = [
  { label: "Dashboard", href: "/seller", icon: LayoutDashboard },
  { label: "Products", href: "/seller/products", icon: Package },
  { label: "Inventory", href: "/seller/inventory", icon: Boxes },
  { label: "Orders", href: "/seller/orders", icon: ShoppingBag },
  { label: "Analytics", href: "/seller/analytics", icon: BarChart3 },
  { label: "Payouts", href: "/seller/payouts", icon: Wallet },
  { label: "Notifications", href: "/seller/notifications", icon: Bell },
  { label: "Support", href: "/seller/support", icon: CircleHelp },
  { label: "Settings", href: "/seller/settings", icon: Settings },
];
