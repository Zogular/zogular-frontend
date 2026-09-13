import type { Metadata } from "next";
import AdminSetupAccountContent from "./AdminSetupAccountContent";

export const metadata: Metadata = {
  title: "Activate Administrator Account | Zogular",
  description: "Set your permanent password to complete your staff profile onboarding.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function AdminSetupAccountPage() {
  return <AdminSetupAccountContent />;
}
