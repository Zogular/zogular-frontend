/**
 * @file page.tsx
 * @module app/admin/(protected)/orders/page
 * @description
 * Orders & Fulfillment Control Center (F6) route entrypoint.
 * Decomposed into a thin layout orchestrator delegating presentation,
 * state management, and lifecycle triage to AdminOrdersWorkspace.
 */

"use client";

import { AdminOrdersWorkspace } from "@/features/admin-orders";

export default function AdminOrdersPage() {
  return <AdminOrdersWorkspace />;
}
