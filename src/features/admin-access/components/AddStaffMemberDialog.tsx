/**
 * @file AddStaffMemberDialog.tsx
 * @module features/admin-access/components
 * @description
 * SUPER_ADMIN-only dialog for onboarding new admin staff directly from the console.
 * Calls POST /admin/team/staff which atomically creates the account with the chosen
 * assignable role, sets mustChangePassword: true, and dispatches a welcome email.
 *
 * Pre-TRIDENT direct-creation path — no email invite token flow.
 */

"use client";

import React, { useState } from "react";
import { UserPlus, AlertTriangle, Mail } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ASSIGNABLE_STAFF_ROLES,
  ASSIGNABLE_STAFF_ROLE_LABELS,
  type AssignableStaffRole,
  type CreateAdminStaffPayload,
} from "../types";
import { createAdminStaff } from "../api/admin-access";

// ---- Validation helpers ----

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  return null;
}

function validatePhone(phone: string): string | null {
  if (!phone.trim()) return "Phone number is required.";
  if (phone.trim().length < 7) return "Enter a valid phone number.";
  return null;
}

function validateName(value: string, label: string): string | null {
  if (!value.trim()) return `${label} is required.`;
  if (value.trim().length > 80) return `${label} must be 80 characters or fewer.`;
  return null;
}

function validateReason(reason: string): string | null {
  if (!reason.trim()) return "Justification is required.";
  if (reason.trim().length < 10) return "Justification must be at least 10 characters.";
  if (reason.trim().length > 500) return "Justification must be 500 characters or fewer.";
  return null;
}

// ---- Component ----

export interface AddStaffMemberDialogProps {
  onSuccess: () => void;
}

export function AddStaffMemberDialog({ onSuccess }: AddStaffMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [role, setRole] = useState<AssignableStaffRole>("TECH_ADMIN");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, setIsPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function resetForm() {
    setFirstName(""); setLastName(""); setEmail("");
    setTelephone(""); setRole("TECH_ADMIN"); setReason("");
    setErrors({}); setSubmitError(null);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    setOpen(next);
  }

  function validate(): boolean {
    const fieldErrors: Record<string, string> = {};
    const firstNameErr = validateName(firstName, "First name");
    if (firstNameErr) fieldErrors.firstName = firstNameErr;
    const lastNameErr = validateName(lastName, "Last name");
    if (lastNameErr) fieldErrors.lastName = lastNameErr;
    const emailErr = validateEmail(email);
    if (emailErr) fieldErrors.email = emailErr;
    const phoneErr = validatePhone(telephone);
    if (phoneErr) fieldErrors.telephone = phoneErr;
    const reasonErr = validateReason(reason);
    if (reasonErr) fieldErrors.reason = reasonErr;
    setErrors(fieldErrors);
    return Object.keys(fieldErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!validate()) return;

    const payload: CreateAdminStaffPayload = {
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     email.trim().toLowerCase(),
      telephone: telephone.trim(),
      role,
      reason:    reason.trim(),
    };

    setIsPending(true);
    try {
      await createAdminStaff(payload);
      toast.success(
        `${ASSIGNABLE_STAFF_ROLE_LABELS[role]} account created for ${payload.firstName} ${payload.lastName}. Welcome email sent.`,
      );
      handleOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create staff account.";
      setSubmitError(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-[#063b29] font-bold text-white shadow-xs hover:bg-[#084d36]"
      >
        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
        Add Staff Member
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <UserPlus className="h-4 w-4 text-[#063b29]" />
              Add Staff Member
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              Create a new administrator account. A welcome email with a temporary password will be sent automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              A system-generated temporary password will be emailed to this address. The staff member must change it on first login.
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="sa-firstName" className="text-xs font-semibold text-zinc-700">First Name</label>
                <Input id="sa-firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Chileshe" disabled={isPending} className="rounded-xl text-sm" />
                {errors.firstName && <p className="text-xs text-red-600">{errors.firstName}</p>}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="sa-lastName" className="text-xs font-semibold text-zinc-700">Last Name</label>
                <Input id="sa-lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mwamba" disabled={isPending} className="rounded-xl text-sm" />
                {errors.lastName && <p className="text-xs text-red-600">{errors.lastName}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sa-email" className="text-xs font-semibold text-zinc-700">Email Address</label>
              <Input id="sa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chileshe@zogular.com" disabled={isPending} className="rounded-xl text-sm" />
              {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sa-phone" className="text-xs font-semibold text-zinc-700">Phone Number</label>
              <Input id="sa-phone" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+260 9X XXX XXXX" disabled={isPending} className="rounded-xl text-sm" />
              {errors.telephone && <p className="text-xs text-red-600">{errors.telephone}</p>}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sa-role" className="text-xs font-semibold text-zinc-700">Governance Role</label>
              <select
                id="sa-role"
                value={role}
                onChange={(e) => setRole(e.target.value as AssignableStaffRole)}
                disabled={isPending}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 text-sm font-medium text-zinc-900 shadow-inner focus:border-[#063b29] focus:outline-none focus:ring-1 focus:ring-[#063b29]"
              >
                {ASSIGNABLE_STAFF_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ASSIGNABLE_STAFF_ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="sa-reason" className="text-xs font-semibold text-zinc-700">Justification</label>
              <Textarea id="sa-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this person being added to the admin team?" disabled={isPending} rows={3} maxLength={500} className="resize-none rounded-xl text-sm" />
              <div className="flex justify-between">
                {errors.reason ? <p className="text-xs text-red-600">{errors.reason}</p> : <span />}
                <span className="text-xs text-zinc-400">{reason.length}/500</span>
              </div>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)} disabled={isPending} className="rounded-xl">Cancel</Button>
              <Button type="submit" size="sm" disabled={isPending} className="rounded-xl bg-[#063b29] font-bold text-white hover:bg-[#084d36]">
                {isPending ? "Creating…" : "Create Staff Account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
