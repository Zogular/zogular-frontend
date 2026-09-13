/**
 * @file AdminRoleElevationDialog.tsx
 * @module features/admin-access/components
 * @description
 * Controlled security dialog for SUPER_ADMIN to elevate or reassign staff roles.
 * Enforces mandatory justification text (>= 10 characters) and standardized reason codes.
 * Revokes all active refresh sessions upon execution as required by Global Admin Authority Baseline.
 */

"use client";

import React, { useState } from "react";
import { AlertTriangle, KeyRound, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ALLOWED_ASSIGNABLE_ROLES,
  ROLE_ELEVATION_REASON_CODES,
  type AdminUserRecord,
} from "../types";

export interface AdminRoleElevationDialogProps {
  open: boolean;
  onClose: () => void;
  admin: AdminUserRecord | null;
  onConfirm: (
    adminId: string,
    role: string,
    reason: string,
    reasonCode: string,
  ) => Promise<boolean>;
  isMutating: boolean;
}

export function AdminRoleElevationDialog({
  open,
  onClose,
  admin,
  onConfirm,
  isMutating,
}: AdminRoleElevationDialogProps) {
  const [targetRole, setTargetRole] = useState<string>("TECH_ADMIN");
  const [reasonCode, setReasonCode] = useState<string>("PROMOTION");
  const [reason, setReason] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync initial state when admin changes
  React.useEffect(() => {
    if (admin) {
      const defaultRole =
        admin.role === "TECH_ADMIN" ? "EXECUTIVE" : "TECH_ADMIN";
      setTargetRole(defaultRole);
      setReasonCode("PROMOTION");
      setReason("");
      setValidationError(null);
    }
  }, [admin]);

  if (!admin) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!admin) return;

    if (targetRole === admin.role) {
      setValidationError("The selected role is already assigned to this administrator.");
      return;
    }

    if (reason.trim().length < 10) {
      setValidationError("Please enter an operational justification of at least 10 characters.");
      return;
    }

    setValidationError(null);
    const success = await onConfirm(admin.id, targetRole, reason.trim(), reasonCode);
    if (success) {
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md border-[#063b29]/15 bg-[#fff8ec]/95 p-6 shadow-2xl backdrop-blur-xl sm:rounded-3xl">
        <DialogHeader className="space-y-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#063b29] text-emerald-300 shadow-md">
            <KeyRound className="h-5 w-5" />
          </div>
          <DialogTitle className="text-xl font-black text-zinc-950">
            Reassign Administrator Role
          </DialogTitle>
          <DialogDescription className="text-xs font-semibold text-zinc-600">
            Modifying authority for{" "}
            <strong className="text-zinc-900">
              {admin.firstName} {admin.lastName}
            </strong>{" "}
            ({admin.email}).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Security Notice */}
          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 text-xs text-amber-950">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <p className="leading-snug">
              <strong>Session Invalidation:</strong> Changing role immediately revokes
              all active refresh sessions and updates permissions upon next operator login.
            </p>
          </div>

          {/* Role Selection Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
              Target Role
            </label>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-900 shadow-inner focus:border-[#063b29] focus:outline-none focus:ring-1 focus:ring-[#063b29]"
            >
              {ALLOWED_ASSIGNABLE_ROLES.map((role) => (
                <option
                  key={role.value}
                  value={role.value}
                  disabled={role.value === admin.role}
                >
                  {role.label} {role.value === admin.role ? "(Current)" : ""}
                </option>
              ))}
            </select>
            <p className="text-[11px] font-medium text-zinc-500">
              {ALLOWED_ASSIGNABLE_ROLES.find((r) => r.value === targetRole)?.description}
            </p>
          </div>

          {/* Reason Code Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
              Reason Code
            </label>
            <select
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-bold text-zinc-900 shadow-inner focus:border-[#063b29] focus:outline-none focus:ring-1 focus:ring-[#063b29]"
            >
              {ROLE_ELEVATION_REASON_CODES.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
          </div>

          {/* Justification Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-zinc-700">
              Operational Justification (Min 10 characters)
            </label>
            <Textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="e.g. Promoted to Technical Administrator to oversee automated storage purge jobs and system logs."
              rows={3}
              className="rounded-xl border-zinc-200 bg-white text-xs font-medium focus-visible:ring-[#063b29]"
            />
          </div>

          {/* Error display */}
          {validationError ? (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-bold text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isMutating}
              className="rounded-xl font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isMutating}
              className="rounded-xl bg-[#063b29] font-black text-white hover:bg-[#063b29]/90"
            >
              {isMutating ? "Applying Role Change..." : "Confirm Role Change"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
