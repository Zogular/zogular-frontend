/**
 * @file page.tsx
 * @module app/admin/(protected)/access/page
 * @description
 * Access Control, Governance & Central Audit Log Explorer (F9) route entrypoint.
 * Decomposed into a clean layout orchestrator delegating directly to AdminAccessWorkspace.
 */

import { Suspense } from "react";
import { AdminAccessWorkspace } from "@/features/admin-access";

export default function AdminAccessPage() {
  return (
    <Suspense fallback={null}>
      <AdminAccessWorkspace />
    </Suspense>
  );
}
