"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader, AdminDataGrid, AdminDetailSheet, AdminEmptyState, AdminBadge } from "@/components/admin/AdminPrimitives";
import { adminAccessApi, AdminUserRecord } from "@/services/admin/access";
import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";
import { useAdminIdentity } from "@/components/admin/AdminShell";

export default function AdminAccessPage() {
  const identity = useAdminIdentity();
  const [admins, setAdmins] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedAdmin, setSelectedAdmin] = useState<AdminUserRecord | null>(null);
  const [mutating, setMutating] = useState(false);

  const fetchAdminsList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminAccessApi.fetchAdmins();
      setAdmins(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admins.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdminsList();
  }, [fetchAdminsList]);

  const handleToggleStatus = async () => {
    if (!selectedAdmin || mutating) return;
    try {
      setMutating(true);
      if (selectedAdmin.isActive) {
        await adminAccessApi.revokeAccess(selectedAdmin.id);
      } else {
        await adminAccessApi.restoreAccess(selectedAdmin.id);
      }
      await fetchAdminsList();
      setSelectedAdmin((current) => current ? { ...current, isActive: !current.isActive } : null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setMutating(false);
    }
  };

  const isSuperAdmin = identity?.claims.role === "SUPER_ADMIN";

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-12">
      <AdminPageHeader title="Access Control" description="Manage administrator identities and roles." />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
      ) : null}

      <AdminDataGrid
        items={admins}
        loading={loading}
        onRowClick={setSelectedAdmin}
        emptyState={{ title: "No admins found", description: "No administrator accounts match the query." }}
        columns={[
          {
            header: "Administrator",
            cell: (admin) => (
              <div>
                <p className="font-black text-zinc-950">{admin.firstName} {admin.lastName}</p>
                <p className="text-xs font-semibold text-zinc-500">{admin.email}</p>
              </div>
            ),
          },
          {
            header: "Role",
            cell: (admin) => (
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">{admin.role.replace(/_/g, " ")}</span>
            ),
          },
          {
            header: "Status",
            cell: (admin) => (
              <AdminBadge variant={admin.isActive ? "success" : "danger"}>
                {admin.isActive ? "Active" : "Revoked"}
              </AdminBadge>
            ),
          },
          {
            header: "Joined",
            cell: (admin) => <span className="text-sm font-bold text-zinc-700">{formatAdminDateTime(admin.createdAt)}</span>,
          },
        ]}
      />

      <AdminDetailSheet
        isOpen={selectedAdmin !== null}
        onClose={() => setSelectedAdmin(null)}
        title={selectedAdmin ? "Administrator Context" : "Loading..."}
        badge={selectedAdmin?.isActive ? "Active account" : "Revoked"}
      >
        {selectedAdmin ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Identity Snapshot</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                <p><strong>Name:</strong> {selectedAdmin.firstName} {selectedAdmin.lastName}</p>
                <p><strong>Email:</strong> {selectedAdmin.email}</p>
                <p><strong>Role:</strong> {toTitleCase(selectedAdmin.role.replace(/_/g, " "))}</p>
                <p><strong>Joined:</strong> {formatAdminDateTime(selectedAdmin.createdAt)}</p>
              </div>
            </div>

            {isSuperAdmin && identity.claims.sub !== selectedAdmin.id && selectedAdmin.role !== "SUPER_ADMIN" ? (
              <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-4">
                <h3 className="text-sm font-black text-sky-950">Security Control</h3>
                <div className="mt-4">
                  <button
                    disabled={mutating}
                    onClick={() => void handleToggleStatus()}
                    className={`w-full rounded-xl px-3 py-2 text-sm font-bold text-white transition-opacity disabled:opacity-50 ${selectedAdmin.isActive ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                  >
                    {mutating ? "Applying..." : selectedAdmin.isActive ? "Revoke Access" : "Restore Access"}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <AdminEmptyState title="No admin selected" description="Select an account from the directory." />
        )}
      </AdminDetailSheet>
    </div>
  );
}
