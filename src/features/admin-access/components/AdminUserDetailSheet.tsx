/**
 * @file AdminUserDetailSheet.tsx
 * @module features/admin-access/components
 * @description
 * Slide-out inspection drawer for an individual administrator account.
 * Displays identity verification status, dynamic role capability accordion,
 * and security governance actions (role elevation trigger, status revocation/restoration).
 */

"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import {
  AdminDetailSheet,
  AdminStatusBadge,
} from "@/components/admin/AdminPrimitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { formatAdminDateTime } from "@/lib/admin-format";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { adminIdentityHasPermission } from "@/services/admin/session";
import { AdminRoleBadge } from "./AdminUsersTable";
import {
  CANONICAL_PERMISSION_CATALOG,
  CANONICAL_ROLE_PERMISSIONS,
  type CanonicalAdminRole,
  type AdminUserRecord,
} from "../types";

export interface AdminUserDetailSheetProps {
  admin: AdminUserRecord | null;
  onClose: () => void;
  onOpenElevation: (admin: AdminUserRecord) => void;
  onToggleStatus: (
    adminId: string,
    nextIsActive: boolean,
    reason: string,
    reasonCode: string,
  ) => Promise<boolean>;
  isMutating: boolean;
}

export function AdminUserDetailSheet({
  admin,
  onClose,
  onOpenElevation,
  onToggleStatus,
  isMutating,
}: AdminUserDetailSheetProps) {
  const identity = useAdminIdentity();

  // Status toggle confirmation mode
  const [confirmingStatus, setConfirmingStatus] = useState(false);
  const [toggleReason, setToggleReason] = useState("");
  const [toggleReasonCode, setToggleReasonCode] = useState("OPERATOR_OFFBOARDING");

  if (!admin) return null;

  const isSelf = identity?.id === admin.id;
  const isTargetSuperAdmin = admin.role === "SUPER_ADMIN";
  const callerIsSuperAdmin = identity?.claims.role === "SUPER_ADMIN";
  const canManageRoles = identity
    ? adminIdentityHasPermission(identity, "manage_roles")
    : false;
  const canEditUsers = identity
    ? adminIdentityHasPermission(identity, "edit_users")
    : false;

  // Can caller elevate this admin?
  const canChangeRole =
    callerIsSuperAdmin && canManageRoles && !isSelf && !isTargetSuperAdmin;

  // Can caller deactivate or restore this admin?
  const canToggleStatus =
    callerIsSuperAdmin && canEditUsers && !isSelf && !isTargetSuperAdmin;

  // Determine effective permissions for the admin's role
  const effectivePermissionKeys =
    CANONICAL_ROLE_PERMISSIONS[admin.role as CanonicalAdminRole] || [];

  // Group active permissions by domain for clean presentation
  const groupedPermissions = CANONICAL_PERMISSION_CATALOG.reduce<
    Record<string, typeof CANONICAL_PERMISSION_CATALOG[number][]>
  >((acc, perm) => {
    if (!acc[perm.domain]) acc[perm.domain] = [];
    acc[perm.domain].push(perm);
    return acc;
  }, {});

  async function handleConfirmStatusToggle() {
    if (!admin) return;
    const reasonText =
      toggleReason.trim() ||
      (admin.isActive
        ? "Administrative deactivation of operator account."
        : "Reactivation of operator privileges.");

    const success = await onToggleStatus(
      admin.id,
      !admin.isActive,
      reasonText,
      toggleReasonCode,
    );

    if (success) {
      setConfirmingStatus(false);
      setToggleReason("");
    }
  }

  return (
    <AdminDetailSheet
      open={Boolean(admin)}
      onOpenChange={(open) => {
        if (!open) {
          setConfirmingStatus(false);
          onClose();
        }
      }}
      title={`${admin.firstName} ${admin.lastName}`}
      description={`${admin.email} · ${admin.role.replace(/_/g, " ")}`}
    >
      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* IDENTITY SNAPSHOT CARD */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Identity Verification
            </h3>
            <AdminRoleBadge role={admin.role} />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-zinc-400">Account Status</span>
              <div>
                <AdminStatusBadge tone={admin.isActive ? "emerald" : "rose"}>
                  {admin.isActive ? "Active Operator" : "Privileges Revoked"}
                </AdminStatusBadge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-zinc-400">Joined Platform</span>
              <p className="text-xs font-bold text-zinc-800">
                {formatAdminDateTime(admin.createdAt)}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-zinc-400">Email Verification</span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                <Mail className="h-3.5 w-3.5 text-zinc-400" />
                {admin.emailVerifiedAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-zinc-500">
                    <XCircle className="h-3.5 w-3.5 text-zinc-400" />
                    Pending
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-zinc-400">Phone Verification</span>
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
                <Phone className="h-3.5 w-3.5 text-zinc-400" />
                {admin.phoneVerifiedAt ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-zinc-500">
                    <XCircle className="h-3.5 w-3.5 text-zinc-400" />
                    Unlinked / Pending
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SECURITY & GOVERNANCE ACTIONS */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/90 p-5 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
            Governance Actions
          </h3>

          {isSelf ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs font-bold text-zinc-600">
              <Lock className="h-4 w-4 text-zinc-400" />
              <span>You cannot modify your own role or active status.</span>
            </div>
          ) : isTargetSuperAdmin ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-purple-200 bg-purple-50 p-3 text-xs font-bold text-purple-900">
              <ShieldAlert className="h-4 w-4 text-purple-700" />
              <span>
                SUPER_ADMIN accounts are protected bootstrap authorities and cannot be
                mutated via console controls.
              </span>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {/* Change Role Trigger */}
              {canChangeRole ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenElevation(admin)}
                  className="w-full justify-between rounded-xl border-zinc-300 font-bold text-zinc-900 hover:border-[#063b29] hover:bg-[#fff8ec]"
                >
                  <span className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-zinc-600" />
                    Reassign Governance Role
                  </span>
                  <span className="text-xs text-zinc-400">Elevate / Demote</span>
                </Button>
              ) : null}

              {/* Status Revocation / Restoration */}
              {canToggleStatus ? (
                confirmingStatus ? (
                  <div className="space-y-3 rounded-2xl border border-zinc-200 bg-[#fff8ec]/70 p-4">
                    <p className="text-xs font-bold text-zinc-900">
                      Confirm {admin.isActive ? "Access Revocation" : "Privilege Restoration"}:
                    </p>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600">
                        Reason Code
                      </label>
                      <select
                        value={toggleReasonCode}
                        onChange={(e) => setToggleReasonCode(e.target.value)}
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-bold text-zinc-900"
                      >
                        <option value="OPERATOR_OFFBOARDING">Staff Offboarding</option>
                        <option value="SECURITY_HOLD">Security Hold / Investigation</option>
                        <option value="TEMPORARY_LEAVE">Temporary Leave</option>
                        <option value="SCHEDULED_REACTIVATION">Scheduled Reactivation</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-zinc-600">
                        Optional Note
                      </label>
                      <input
                        type="text"
                        value={toggleReason}
                        onChange={(e) => setToggleReason(e.target.value)}
                        placeholder="Justification for audit trail..."
                        className="w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmingStatus(false)}
                        className="flex-1 rounded-xl font-bold"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isMutating}
                        onClick={() => void handleConfirmStatusToggle()}
                        className={`flex-1 rounded-xl font-black text-white ${
                          admin.isActive
                            ? "bg-rose-600 hover:bg-rose-700"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {isMutating
                          ? "Applying..."
                          : admin.isActive
                            ? "Confirm Revoke"
                            : "Confirm Restore"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmingStatus(true)}
                    className={`w-full justify-start gap-2 rounded-xl font-bold ${
                      admin.isActive
                        ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                        : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    }`}
                  >
                    {admin.isActive ? (
                      <>
                        <UserX className="h-4 w-4 text-rose-600" />
                        Revoke Administrator Access
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 text-emerald-600" />
                        Restore Administrator Access
                      </>
                    )}
                  </Button>
                )
              ) : null}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* EFFECTIVE ROLE PERMISSIONS ACCORDION */}
        {/* ========================================================================= */}
        <div className="rounded-3xl border border-[#063b29]/15 bg-white/90 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Role Capabilities Summary
            </h3>
            <span className="text-[11px] font-bold text-zinc-500">
              {effectivePermissionKeys.length} Authorized
            </span>
          </div>

          <Accordion type="single" collapsible className="mt-3 w-full">
            {Object.entries(groupedPermissions).map(([domain, perms]) => {
              const activeCount = perms.filter((p) =>
                effectivePermissionKeys.includes(p.key),
              ).length;

              return (
                <AccordionItem key={domain} value={domain} className="border-zinc-100">
                  <AccordionTrigger className="py-2.5 text-xs font-bold text-zinc-900 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 text-[#063b29]" />
                      {domain}
                    </span>
                    <span className="mr-2 rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-black text-zinc-600">
                      {activeCount} / {perms.length}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-2 pt-1 pb-3">
                    {perms.map((perm) => {
                      const hasPerm = effectivePermissionKeys.includes(perm.key);
                      return (
                        <div
                          key={perm.key}
                          className="flex items-start justify-between gap-2 rounded-xl bg-zinc-50/70 p-2 text-xs"
                        >
                          <div>
                            <p
                              className={`font-black ${
                                hasPerm ? "text-zinc-900" : "text-zinc-400 line-through"
                              }`}
                            >
                              {perm.name}
                            </p>
                            <p className="text-[11px] text-zinc-500">
                              {perm.description}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                              hasPerm
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-zinc-100 text-zinc-400"
                            }`}
                          >
                            {hasPerm ? "Granted" : "Denied"}
                          </span>
                        </div>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </div>
    </AdminDetailSheet>
  );
}
