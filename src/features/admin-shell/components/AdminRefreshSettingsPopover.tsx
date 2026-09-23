"use client";

/**
 * @file AdminRefreshSettingsPopover.tsx
 * @module features/admin-shell/components
 * @description
 * Popover configuration panel for administrative data refresh preferences.
 *
 * Capabilities:
 * - Select canonical refresh cadence: Every minute, Every 5 minutes (default), or Manual only
 * - Clear operator guidance: hidden tabs pause automatically, faster checks use more database activity
 * - Toggle refresh on navigation
 * - Reset preferences to platform defaults
 * - Keyboard accessible, responsive, and styled with Zogular's tactile warm palette
 */

import React from "react";
import { Check, Clock, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ADMIN_REFRESH_INTERVAL_OPTIONS,
  type AdminRefreshInterval,
  type AdminRefreshPolicy,
} from "../hooks/useAdminRefreshPolicy";
import { cn } from "@/lib/utils";

interface AdminRefreshSettingsPopoverProps {
  policy: AdminRefreshPolicy;
}

export function AdminRefreshSettingsPopover({ policy }: AdminRefreshSettingsPopoverProps) {
  const { settings, updateSettings, resetSettings } = policy;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 border-[color:rgba(184,135,70,0.32)] bg-[var(--admin-surface-mist)] text-[var(--admin-ink)] shadow-[inset_0_1px_0_rgba(255,248,236,0.6)] hover:border-[color:rgba(184,135,70,0.52)] hover:bg-[var(--admin-canvas-warm)] focus-visible:ring-[var(--admin-ember)]"
          aria-label="Data refresh settings"
          data-testid="admin-refresh-settings-trigger"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="flex w-[min(24rem,calc(100vw-2rem))] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl border-[#b887464d] bg-[#fff8ec] p-0 text-[#171a16] shadow-xl"
        style={{
          maxHeight: "min(34rem, var(--radix-popover-content-available-height, calc(100dvh - 2rem)))",
        }}
        data-testid="admin-refresh-settings-popover"
      >
        <PopoverHeader className="shrink-0 gap-1 border-b border-[#b8874638] p-4">
          <div className="flex items-center justify-between">
            <PopoverTitle className="flex items-center gap-2 text-sm font-semibold text-[var(--admin-ink)]">
              <Clock className="size-4 text-[var(--admin-canopy)]" aria-hidden="true" />
              Data Refresh Settings
            </PopoverTitle>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                settings.autoRefreshEnabled && settings.intervalMs > 0
                  ? "bg-[color:rgba(7,91,54,0.1)] text-[var(--admin-canopy)]"
                  : "bg-[var(--admin-canvas-depth)] text-[var(--admin-ink-soft)]",
              )}
            >
              {settings.autoRefreshEnabled && settings.intervalMs > 0 ? "Active" : "Manual"}
            </span>
          </div>
          <PopoverDescription className="text-xs text-[var(--admin-ink-soft)]">
            Configure how often this workspace updates while open.
          </PopoverDescription>
        </PopoverHeader>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-4 text-xs"
          data-testid="admin-refresh-settings-body"
        >
          {/* Refresh Mode / Interval Selection */}
          <div className="space-y-2">
            <label className="block font-semibold text-[var(--admin-ink)]">
              Refresh interval
            </label>
            <div className="grid grid-cols-1 gap-1.5" role="radiogroup" aria-label="Refresh interval">
              {ADMIN_REFRESH_INTERVAL_OPTIONS.map((option) => {
                const isSelected = settings.intervalMs === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      updateSettings({
                        intervalMs: option.value as AdminRefreshInterval,
                        autoRefreshEnabled: option.value !== 0,
                      });
                    }}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-2.5 text-left transition-all",
                      isSelected
                        ? "border-[var(--admin-canopy)] bg-[color:rgba(7,91,54,0.07)] text-[var(--admin-canopy-deep)] font-semibold shadow-xs"
                        : "border-[color:rgba(184,135,70,0.22)] bg-[var(--admin-surface-cream)] text-[var(--admin-ink)] hover:border-[color:rgba(184,135,70,0.4)] hover:bg-[var(--admin-surface-mist)]",
                    )}
                    data-testid={`refresh-interval-${option.value}`}
                  >
                    <div>
                      <p className="text-xs">{option.label}</p>
                      <p className="text-[10px] text-[var(--admin-ink-soft)]">{option.description}</p>
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 text-[var(--admin-canopy)]" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[color:rgba(184,135,70,0.2)] pt-3 space-y-3">
            {/* Non-interactive statement for hidden tabs */}
            <div
              className="rounded-xl border border-[color:rgba(184,135,70,0.22)] bg-[var(--admin-surface-mist)] p-2.5"
              data-testid="refresh-hidden-tab-notice"
            >
              <p className="font-semibold text-[var(--admin-ink)]">Automatic pause when hidden</p>
              <p className="mt-0.5 text-[11px] text-[var(--admin-ink-soft)] leading-snug">
                Background checking stops automatically whenever this tab is hidden to save battery and network bandwidth.
              </p>
            </div>

            {/* Refresh on navigation toggle */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.refreshOnNavigation}
                onChange={(e) => updateSettings({ refreshOnNavigation: e.target.checked })}
                className="mt-0.5 size-4 rounded border-[color:rgba(184,135,70,0.4)] text-[var(--admin-canopy)] focus:ring-[var(--admin-canopy)]"
                data-testid="refresh-toggle-on-navigation"
              />
              <div className="min-w-0">
                <span className="font-semibold text-[var(--admin-ink)] block">
                  Check when navigating
                </span>
                <span className="text-[11px] text-[var(--admin-ink-soft)] block leading-tight">
                  Automatically verify data freshness when returning to this workspace
                </span>
              </div>
            </label>
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between border-t border-[#b8874638] bg-[var(--admin-surface-mist)] p-3 rounded-b-2xl">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={resetSettings}
            className="h-8 gap-1.5 text-xs text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            data-testid="refresh-reset-defaults"
          >
            <RotateCcw className="size-3.5" />
            Reset to defaults
          </Button>
          <span className="text-[11px] text-[var(--admin-ink-soft)]">
            Saved per browser
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}
