import type { Metadata } from "next";
import { AccountSetupContent } from "@/components/auth/AccountSetupContent";

export const metadata: Metadata = {
  title: "Activate your account | Zogular",
  description: "Set a secure password to activate your Zogular account.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function CustomerSetupAccountPage() {
  return <AccountSetupContent audience="customer" />;
}
