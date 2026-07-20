"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminPageHeader,
  AdminDetailSheet,
  AdminEmptyState,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
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

      <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-xl shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead>
              <tr className="bg-zinc-50 text-left text-xs font-black uppercase tracking-wider text-zinc-500">
                <th className="rounded-tl-3xl px-5 py-4">Customer</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Email</th>
                <th className="rounded-tr-3xl px-5 py-4">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`loading-${i}`}>
                    <td colSpan={4} className="px-5 py-4">
                      <div className="h-10 w-full animate-pulse rounded-xl bg-zinc-200/50" />
                    </td>
                  </tr>
                ))
              ) : buyers.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <AdminEmptyState title="No buyers found" description="No buyer accounts match the current query." />
                  </td>
                </tr>
              ) : (
                buyers.map((buyer) => (
                  <tr
                    key={buyer.id}
                    onClick={() => setSelectedBuyer(buyer)}
                    className="cursor-pointer transition-colors hover:bg-zinc-50"
                  >
                    <td className="px-5 py-4">
                      <p className="font-black text-zinc-950">{buyer.firstName} {buyer.lastName}</p>
                      <p className="text-xs font-semibold text-zinc-500">{buyer.telephone ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <AdminStatusBadge tone={buyer.isActive ? "emerald" : "rose"}>
                        {buyer.isActive ? "Active" : "Inactive"}
                      </AdminStatusBadge>
                    </td>
                    <td className="px-5 py-4 text-sm font-semibold text-zinc-700">{buyer.email}</td>
                    <td className="px-5 py-4 text-sm font-bold text-zinc-700">{formatAdminDateTime(buyer.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
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
        open={selectedBuyer !== null}
        onOpenChange={(open) => { if (!open) setSelectedBuyer(null); }}
        title={selectedBuyer ? "Buyer Context" : "Loading..."}
        description={selectedBuyer ? `${selectedBuyer.email} · ${selectedBuyer.isActive ? "Active" : "Deactivated"}` : "Select a buyer to view details."}
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
