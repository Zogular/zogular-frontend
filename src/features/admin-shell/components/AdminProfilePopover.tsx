"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LoaderCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toSafeAdminError } from "@/features/admin-platform";
import { logoutAdmin } from "@/services/admin/auth";
import { getAdminInitials, type AdminIdentity } from "@/services/admin/session";
import { formatAdminRole } from "../lib/admin-shell-model";

export function getAdminSignOutFailureMessage(error: unknown): string {
  return toSafeAdminError(error).message;
}

export function AdminProfilePopover({ identity }: { identity: AdminIdentity }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [status, setStatus] = useState("");

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setStatus("Signing out securely.");

    try {
      const session = await logoutAdmin();
      const successMessage = "Signed out safely.";
      setStatus(successMessage);
      toast.success(successMessage);
      router.replace(session.nextPath);
      router.refresh();
    } catch (error) {
      const safeMessage = getAdminSignOutFailureMessage(error);
      setStatus(safeMessage);
      toast.error(safeMessage);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-11 min-w-11 gap-2 rounded-xl px-1.5 text-[var(--admin-ink)] hover:bg-[var(--admin-surface-mist)] sm:px-2.5"
          aria-label={`Open admin profile for ${identity.name}`}
          data-testid="admin-profile-trigger"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[color:rgba(184,135,70,0.38)] bg-[var(--admin-copper-muted)] text-xs font-bold text-[var(--admin-ink)] shadow-[inset_0_1px_0_rgba(255,248,236,0.55)]">
            {getAdminInitials(identity.name)}
          </span>
          <span className="hidden max-w-36 truncate text-sm font-semibold md:inline">{identity.name}</span>
          <ChevronDown aria-hidden="true" className="hidden size-3.5 text-[var(--admin-ink-soft)] sm:block" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[min(20rem,calc(100vw-1.5rem))] gap-0 rounded-xl border-[#b887464d] bg-[#fff8ec] p-0 text-[#171a16] shadow-xl"
      >
        <PopoverHeader className="gap-1 border-b border-[#b8874638] p-4">
          <PopoverTitle className="truncate font-semibold">{identity.name}</PopoverTitle>
          <PopoverDescription className="truncate text-[#5f625a]">{identity.email}</PopoverDescription>
          <p className="pt-1 text-xs font-semibold uppercase tracking-[0.11em] text-[#075b36]">
            {formatAdminRole(identity.claims.role)}
          </p>
        </PopoverHeader>
        <div className="p-2">
          <Button
            type="button"
            variant="ghost"
            className="h-11 w-full justify-start gap-2 px-3 text-[#b83b32] hover:bg-[#b83b3214] hover:text-[#b83b32]"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? <LoaderCircle className="animate-spin motion-reduce:animate-none" /> : <LogOut />}
            {isSigningOut ? "Signing out" : "Sign out"}
          </Button>
          <p className="sr-only" aria-live="polite" aria-atomic="true">
            {status}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
