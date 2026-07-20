"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader, AdminDataGrid, AdminDetailSheet, AdminEmptyState, AdminBadge } from "@/components/admin/AdminPrimitives";
import { adminBuyersApi, AdminBuyerRecord } from "@/services/admin/buyers";

import { formatAdminDateTime, toTitleCase } from "@/lib/admin-format";

export default function AdminBuyersPage() {
  const [buyers, setBuyers] = useState<AdminBuyerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [selectedBuyer, setSelectedBuyer] = useState<AdminBuyerRecord | null>(null);

  const fetchBuyersList = useCallback(async (targetPage: number) => {
    try {
      setLoading(true);
      setError(null);
      const result = await adminBuyersApi.fetchBuyers(targetPage, 20);
      setBuyers(result.buyers);
      setTotalPages(result.pagination.pages);
      setTotalCount(result.pagination.total);
      setPage(result.pagination.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load buyers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBuyersList(1);
  }, [fetchBuyersList]);

  return (
    <div className="mx-auto max-w-[96rem] space-y-5 pb-12">
      <AdminPageHeader title="Buyers CRM" description="Manage buyer accounts and view platform customers." />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>
      ) : null}

      <AdminDataGrid
        items={buyers}
        loading={loading}
        onRowClick={setSelectedBuyer}
        emptyState={{ title: "No buyers found", description: "No buyer accounts match the current query." }}
        columns={[
          {
            header: "Customer",
            cell: (buyer) => (
              <div>
                <p className="font-black text-zinc-950">{buyer.firstName} {buyer.lastName}</p>
                <p className="text-xs font-semibold text-zinc-500">{buyer.email}</p>
              </div>
            ),
          },
          {
            header: "Status",
            cell: (buyer) => (
              <AdminBadge variant={buyer.isActive ? "success" : "danger"}>
                {buyer.isActive ? "Active" : "Inactive"}
              </AdminBadge>
            ),
          },
          {
            header: "Verified",
            cell: (buyer) => (
              <AdminBadge variant={buyer.emailVerified ? "neutral" : "warning"}>
                {buyer.emailVerified ? "Verified" : "Unverified"}
              </AdminBadge>
            ),
          },
          {
            header: "Joined",
            cell: (buyer) => <span className="text-sm font-bold text-zinc-700">{formatAdminDateTime(buyer.createdAt)}</span>,
          },
        ]}
      />

      <div className="flex items-center justify-between mt-4">
        <p className="text-sm font-bold text-zinc-500">Total {totalCount} buyers</p>
        <div className="flex gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => void fetchBuyersList(page - 1)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={page >= totalPages || loading}
            onClick={() => void fetchBuyersList(page + 1)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      <AdminDetailSheet
        isOpen={selectedBuyer !== null}
        onClose={() => setSelectedBuyer(null)}
        title={selectedBuyer ? "Buyer Context" : "Loading..."}
        badge={selectedBuyer?.isActive ? "Active account" : "Deactivated"}
      >
        {selectedBuyer ? (
          <div className="space-y-4">
            <div className="rounded-3xl border border-zinc-100 bg-white p-4">
              <h3 className="text-sm font-black text-zinc-950">Identity Snapshot</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                <p><strong>Name:</strong> {selectedBuyer.firstName} {selectedBuyer.lastName}</p>
                <p><strong>Email:</strong> {selectedBuyer.email}</p>
                <p><strong>Phone:</strong> {selectedBuyer.telephone ?? "Not recorded"}</p>
                <p><strong>Joined:</strong> {formatAdminDateTime(selectedBuyer.createdAt)}</p>
              </div>
            </div>

            <div className="rounded-3xl border border-sky-200 bg-sky-50/60 p-4">
              <h3 className="text-sm font-black text-sky-950">Account Status</h3>
              <div className="mt-3 grid gap-2 text-sm text-zinc-700">
                <p><strong>Role:</strong> {toTitleCase(selectedBuyer.role.replace(/_/g, " "))}</p>
                <p><strong>Email verification:</strong> {selectedBuyer.emailVerified ? "Verified" : "Pending"}</p>
                <p><strong>System status:</strong> {selectedBuyer.isActive ? "Active (Login allowed)" : "Suspended (Login blocked)"}</p>
              </div>
            </div>
            
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-900 leading-tight">
              Detailed order history, refunds, and analytics are not managed from this view. Use the Order Queue for fulfillment resolution.
            </div>
          </div>
        ) : (
          <AdminEmptyState title="No buyer selected" description="Select an account from the directory." />
        )}
      </AdminDetailSheet>
    </div>
  );
}
