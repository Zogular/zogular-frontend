"use client";

/**
 * @file page.tsx
 * @description
 * Thin layout orchestrator for the Zogular Support Operations Center (F8).
 * Modularized and delegated to @/features/admin-support.
 */

import { AdminSupportWorkspace } from "@/features/admin-support";

export default function AdminSupportPage() {
  return <AdminSupportWorkspace />;
}
