/**
 * @file LedgerTransactionsTable.tsx
 * @module features/admin-finance/components
 * @description
 * Immutable audit ledger table for marketplace money events.
 * Displays Transaction Type chips, linked Order IDs, Vendor Names, Gross/Commission/Net amounts,
 * and precise timestamps.
 */

import React from "react";
import {
  FileSpreadsheet,
  Package,
  Store,
} from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminPrimitives";
import {
  formatAdminCurrency,
  formatAdminDateTime,
} from "@/lib/admin-format";
import { cn } from "@/lib/utils";
import type { AdminLedgerRecord } from "../types";
import { TRANSACTION_TYPE_META } from "../types";

interface LedgerTransactionsTableProps {
  transactions: AdminLedgerRecord[];
  loading?: boolean;
  className?: string;
}

export function LedgerTransactionsTable({
  transactions,
  loading = false,
  className,
}: LedgerTransactionsTableProps) {
  return (
    <section
      aria-label="Immutable ledger records table"
      className={cn(
        "overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_26%,transparent)] bg-[var(--admin-surface-cream,#fff8ec)] shadow-[0_12px_32px_rgb(6_59_41_/_6%)]",
        className
      )}
    >
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[980px] text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_24%,transparent)] bg-[var(--admin-canopy-deep,#063b29)] text-[10px] font-black uppercase tracking-wider text-[var(--admin-surface-cream,#fff8ec)]">
              <th scope="col" className="px-5 py-3.5">Transaction Type & ID</th>
              <th scope="col" className="px-5 py-3.5">Linked Order</th>
              <th scope="col" className="px-5 py-3.5">Store / Vendor</th>
              <th scope="col" className="px-5 py-3.5">Gross (ZMW)</th>
              <th scope="col" className="px-5 py-3.5">Commission (ZMW)</th>
              <th scope="col" className="px-5 py-3.5">Net Disbursable (ZMW)</th>
              <th scope="col" className="px-5 py-3.5 text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color-mix(in_srgb,var(--admin-copper-muted,#b88746)_15%,transparent)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`ledger-skel-${i}`} className="animate-pulse">
                  <td colSpan={7} className="px-5 py-4">
                    <div className="h-6 w-full rounded bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_6%,transparent)]" />
                  </td>
                </tr>
              ))
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-zinc-500">
                  <FileSpreadsheet className="mx-auto h-8 w-8 text-zinc-400 mb-2" />
                  <p className="font-bold text-sm text-zinc-700">No ledger entries recorded</p>
                  <p className="text-xs text-zinc-500">
                    Escrow deposits, releases, and commission withholdings will be audited here.
                  </p>
                </td>
              </tr>
            ) : (
              transactions.map((record) => {
                const meta = TRANSACTION_TYPE_META[record.type] || {
                  label: record.type,
                  description: "",
                  tone: "zinc",
                };

                return (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-[color-mix(in_srgb,var(--admin-canopy,#075b36)_4%,transparent)]"
                  >
                    {/* Type & ID */}
                    <td className="px-5 py-4">
                      <div>
                        <AdminStatusBadge tone={meta.tone}>
                          {meta.label}
                        </AdminStatusBadge>
                        <span className="block font-mono text-[10px] text-zinc-500 mt-1">
                          {record.id}
                        </span>
                      </div>
                    </td>

                    {/* Order */}
                    <td className="px-5 py-4">
                      {record.orderNumber ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-zinc-900">
                          <Package className="h-3 w-3 text-zinc-400" />
                          {record.orderNumber}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Store */}
                    <td className="px-5 py-4">
                      {record.storeName ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-900">
                          <Store className="h-3 w-3 text-[var(--admin-canopy,#075b36)]" />
                          {record.storeName}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">Platform Treasury</span>
                      )}
                    </td>

                    {/* Gross */}
                    <td className="px-5 py-4 font-bold text-xs text-zinc-950">
                      {formatAdminCurrency(record.grossAmount)}
                    </td>

                    {/* Commission */}
                    <td className="px-5 py-4">
                      {record.commissionAmount > 0 ? (
                        <span className="font-bold text-xs text-indigo-900">
                          -{formatAdminCurrency(record.commissionAmount)}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>

                    {/* Net */}
                    <td className="px-5 py-4">
                      <span className="font-black text-xs text-emerald-950">
                        {formatAdminCurrency(record.netAmount)}
                      </span>
                    </td>

                    {/* Timestamp */}
                    <td className="px-5 py-4 text-right">
                      <span className="text-[11px] font-medium text-zinc-600">
                        {formatAdminDateTime(record.timestamp)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
