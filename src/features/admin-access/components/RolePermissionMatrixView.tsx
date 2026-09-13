/**
 * @file RolePermissionMatrixView.tsx
 * @module features/admin-access/components
 * @description
 * Interactive matrix view displaying all 33 canonical permissions across
 * SUPER_ADMIN, TECH_ADMIN, EXECUTIVE, and OPERATIONS roles.
 * Organizes capabilities by domain with checkmark / cross indicators and least-privilege advisories.
 */

"use client";

import React, { useMemo, useState } from "react";
import { Check, Info, Search, ShieldCheck, X } from "lucide-react";
import {
  CANONICAL_PERMISSION_CATALOG,
  CANONICAL_ROLE_PERMISSIONS,
  type CanonicalAdminRole,
} from "../types";

const ROLES: { key: CanonicalAdminRole; label: string; badge: string }[] = [
  { key: "SUPER_ADMIN", label: "Super Admin", badge: "Root Authority" },
  { key: "TECH_ADMIN", label: "Tech Admin", badge: "Engineering & Logs" },
  { key: "EXECUTIVE", label: "Executive", badge: "Read-Only Reports" },
  { key: "OPERATIONS", label: "Operations", badge: "Moderation & Orders" },
];

export function RolePermissionMatrixView() {
  const [filterQuery, setFilterQuery] = useState("");

  // Group permissions by domain, applying filter query
  const groupedCatalog = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    const map = new Map<string, typeof CANONICAL_PERMISSION_CATALOG[number][]>();

    for (const perm of CANONICAL_PERMISSION_CATALOG) {
      if (
        q &&
        !perm.name.toLowerCase().includes(q) &&
        !perm.key.toLowerCase().includes(q) &&
        !perm.domain.toLowerCase().includes(q)
      ) {
        continue;
      }

      const list = map.get(perm.domain) ?? [];
      list.push(perm);
      map.set(perm.domain, list);
    }

    return Array.from(map.entries());
  }, [filterQuery]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* LEAST PRIVILEGE INFORMATION BANNER */}
      {/* ========================================================================= */}
      <div className="flex items-start gap-3 rounded-2xl border border-sky-200/80 bg-sky-50/80 p-4 text-xs font-medium text-sky-950 shadow-sm backdrop-blur-md">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
        <div className="space-y-1">
          <p className="font-bold">
            Canonical Role-Based Access Control (RBAC) Architecture
          </p>
          <p className="text-sky-900/90 leading-relaxed">
            All endpoints enforce server-authoritative permission validation. Admission to an
            administrative route grants no mutation authority by itself. Capabilities are strictly
            bounded to operational necessity following the principle of least privilege.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MATRIX CONTROLS & SEARCH */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#063b29]/10 bg-white/70 p-3 shadow-xs backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:rounded-3xl sm:p-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#063b29]" />
          <h3 className="text-sm font-black text-zinc-900">
            33 Canonical Permission Catalog (25 Operational · 8 Reserved)
          </h3>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search permissions or domains..."
            className="w-full rounded-xl border border-zinc-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium placeholder:text-zinc-400 focus:border-[#063b29] focus:outline-none focus:ring-1 focus:ring-[#063b29]"
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CANONICAL MATRIX TABLE */}
      {/* ========================================================================= */}
      <div className="overflow-hidden rounded-3xl border border-[#063b29]/10 bg-white/90 shadow-lg shadow-zinc-900/5 backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200/80 bg-[#fff8ec]/90 text-zinc-700">
                <th className="px-6 py-4 font-black uppercase tracking-wider text-[11px] sm:w-1/3">
                  Permission / Capability
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role.key}
                    className="px-4 py-4 text-center font-black uppercase tracking-wider text-[10px]"
                  >
                    <span className="block text-zinc-950 font-black">{role.label}</span>
                    <span className="mt-0.5 inline-block text-[9px] font-bold text-zinc-500">
                      {role.badge}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {groupedCatalog.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                    No permissions match &ldquo;{filterQuery}&rdquo;.
                  </td>
                </tr>
              ) : (
                groupedCatalog.map(([domain, perms]) => (
                  <React.Fragment key={domain}>
                    {/* Domain Header Row */}
                    <tr className="bg-zinc-50/90">
                      <td
                        colSpan={5}
                        className="border-t border-b border-zinc-100 px-6 py-2.5 font-black uppercase tracking-wider text-[10px] text-[#063b29]"
                      >
                        <div className="flex items-center justify-between">
                          <span>
                            {domain} Domain ({perms.length})
                          </span>
                          {perms.some((p) => p.isReserved) && (
                            <span className="rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[9px] font-bold tracking-normal text-amber-800">
                              Contract-Gated Reserved Capabilities
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Individual Permission Rows */}
                    {perms.map((perm) => (
                      <tr
                        key={perm.key}
                        className="transition-colors hover:bg-[#fff8ec]/30"
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-zinc-950">{perm.name}</p>
                            {perm.isReserved && (
                              <span className="inline-flex items-center rounded-md border border-amber-300/80 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                                Reserved
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 leading-snug">
                            {perm.description}
                          </p>
                          <code className="mt-1 inline-block rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[9px] text-zinc-600">
                            {perm.key}
                          </code>
                        </td>

                        {ROLES.map((role) => {
                          const hasPermission =
                            CANONICAL_ROLE_PERMISSIONS[role.key].includes(perm.key);

                          return (
                            <td
                              key={`${role.key}-${perm.key}`}
                              className="px-4 py-3.5 text-center"
                            >
                              {hasPermission ? (
                                perm.isReserved ? (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-800 shadow-xs"
                                    title="Capability is contract-gated for future packages"
                                  >
                                    <Check className="h-3 w-3 stroke-[2.5] text-amber-700" />
                                    <span>Reserved</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-xs">
                                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                                  </span>
                                )
                              ) : (
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                                  <X className="h-3.5 w-3.5 stroke-[2]" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
