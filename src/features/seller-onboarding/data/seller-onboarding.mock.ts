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
import type { SellerNavItem, SellerOnboardingMock } from "../types/seller-onboarding.types";

export const sellerOnboardingMock: SellerOnboardingMock = {
  seller: {
    storeName: "Zogular Store",
    ownerName: "Seller Admin",
    status: "Draft",
    sellerType: "Individual seller",
  },
  progress: {
    completed: 2,
    total: 6,
    percent: 33,
    remainingLabel: "4 steps remaining",
  },
  sections: {
    operatingModel: {
      id: "operating-model",
      eyebrow: "Seller model",
      title: "Operating model",
      description: "Choose the legal setup that best matches how this store will trade.",
      status: "completed",
    },
    identity: {
      id: "identity",
      eyebrow: "Identity",
      title: "Store identity",
      description: "Confirm the owner and public store details used during review.",
      status: "pending",
    },
    storeFootprint: {
      id: "store-footprint",
      eyebrow: "Footprint",
      title: "Store footprint",
      description: "Tell review where the seller operates and what categories are planned.",
      status: "pending",
    },
    compliance: {
      id: "compliance",
      eyebrow: "Trust",
      title: "Compliance documents",
      description: "Add identity proof and store evidence for marketplace trust review.",
      status: "missing",
    },
    settlement: {
      id: "settlement",
      eyebrow: "Settlement",
      title: "Payout readiness",
      description: "Set the first payout destination for future seller payments.",
      status: "draft",
    },
  },
  readiness: [
    { label: "Identity", description: "Owner and store details need confirmation.", status: "pending" },
    { label: "Store", description: "District, categories, and address are incomplete.", status: "pending" },
    { label: "Compliance", description: "Document uploads are still required.", status: "pending" },
    { label: "Entity", description: "Individual seller path is ready.", status: "ready" },
    { label: "Settlement", description: "Payout phone still needs to be added.", status: "pending" },
    { label: "Trust", description: "Email and phone checks are verified.", status: "ready" },
  ],
  trustControls: [
    { label: "Email verification", description: "Verified on the seller account.", status: "verified" },
    { label: "Phone verification", description: "Verified with the current profile.", status: "verified" },
    { label: "Identity document", description: "NRC uploads still need review.", status: "pending" },
  ],
  missingItems: [
    "Upload shop photo",
    "Upload NRC front",
    "Upload NRC back",
    "Add payout phone",
    "Confirm product categories",
  ],
  uploads: {
    shopPhoto: {
      title: "Shop photo",
      description: "Show the selling point, workspace, or stock area.",
      status: "empty",
      acceptLabel: "JPG, PNG, WEBP",
    },
    nrcFront: {
      title: "NRC front",
      description: "Upload the front side of the seller NRC.",
      status: "empty",
      acceptLabel: "JPG, PNG, PDF",
    },
    nrcBack: {
      title: "NRC back",
      description: "Upload the back side of the seller NRC.",
      status: "empty",
      acceptLabel: "JPG, PNG, PDF",
    },
  },
};

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
