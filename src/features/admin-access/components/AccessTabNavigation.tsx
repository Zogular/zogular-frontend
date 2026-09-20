/**
 * @file AccessTabNavigation.tsx
 * @module features/admin-access/components
 * @description
 * Tactile, modern tab navigation matching the Zogular warm palette (#fff8ec, canopy #063b29, copper hairlines).
 * Provides fluid switching between Administrators directory, Audit Trail, and Role Matrix.
 */

"use client";

import React from "react";
import { Users, History, ShieldCheck, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccessTabKey } from "../types";

export interface AccessTabNavigationProps {
  activeTab: AccessTabKey;
  onTabChange: (tab: AccessTabKey) => void;
  adminCount: number;
  auditCount: number;
  canViewLogs?: boolean;
}

export function AccessTabNavigation({
  activeTab,
  onTabChange,
  adminCount,
  auditCount,
  canViewLogs = true,
}: AccessTabNavigationProps) {
  const tabs = [
    {
      key: "admins" as AccessTabKey,
      label: "Administrators",
      icon: Users,
      badge: `${adminCount} Active`,
      badgeColor: "bg-emerald-900/10 text-emerald-800 border-emerald-300/40",
      isRestricted: false,
    },
    {
      key: "audit" as AccessTabKey,
      label: "Audit Trail",
      icon: canViewLogs ? History : Lock,
      badge: canViewLogs ? `${auditCount} Events` : "Restricted",
      badgeColor: canViewLogs
        ? "bg-amber-900/10 text-amber-800 border-amber-300/40"
        : "bg-amber-900/10 text-amber-800 border-amber-300/40",
      isRestricted: !canViewLogs,
    },
    {
      key: "matrix" as AccessTabKey,
      label: "Role & Permission Matrix",
      icon: ShieldCheck,
      badge: "33 Canonical",
      badgeColor: "bg-indigo-900/10 text-indigo-800 border-indigo-300/40",
      isRestricted: false,
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#063b29]/10 bg-[#fff8ec]/70 p-1.5 shadow-sm backdrop-blur-md sm:rounded-3xl sm:p-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className={cn(
              "group relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition-all duration-200 sm:flex-none sm:px-5 sm:py-3 sm:text-sm",
              isActive
                ? "bg-[#063b29] text-white shadow-md shadow-[#063b29]/20"
                : "text-zinc-700 hover:bg-[#063b29]/5 hover:text-zinc-950",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                isActive
                  ? "text-emerald-300"
                  : tab.isRestricted
                    ? "text-amber-600 group-hover:text-amber-700"
                    : "text-zinc-500 group-hover:text-zinc-700",
              )}
            />
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              {tab.label}
              {tab.isRestricted && (
                <Lock className="h-3 w-3 text-amber-600 sm:hidden" />
              )}
            </span>
            <span
              className={cn(
                "hidden rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider md:inline-flex md:items-center md:gap-1",
                isActive
                  ? "border-emerald-400/30 bg-emerald-950/60 text-emerald-200"
                  : tab.badgeColor,
              )}
            >
              {tab.isRestricted && <Lock className="h-2.5 w-2.5" />}
              {tab.badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
