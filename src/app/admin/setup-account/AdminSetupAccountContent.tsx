"use client";

import { AccountSetupContent } from "@/components/auth/AccountSetupContent";

/** Thin administrator-route wrapper around the shared activation form. */
export default function AdminSetupAccountContent() {
  return <AccountSetupContent audience="admin" />;
}
