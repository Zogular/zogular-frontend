import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { appendNextPath } from "@/services/auth-intent";
import type { ChecklistItem } from "../types/seller-onboarding.types";
import { StatusBadge } from "./shared/status-badge";

function getVerificationAction(item: ChecklistItem) {
  const label = item.label.toLowerCase();

  if (label.includes("phone")) {
    return {
      href: appendNextPath("/seller/verify-phone", "/seller/onboarding"),
      label: "Verify phone",
    };
  }

  if (label.includes("email")) {
    return {
      href: appendNextPath("/auth/check-email", "/seller/onboarding"),
      label: "Verify email",
    };
  }

  return null;
}

export function AccountChecksList({
  items,
  accountActive,
}: {
  items: ChecklistItem[];
  accountActive: boolean | null;
}) {
  const accountItem: ChecklistItem = {
    label: "Account status",
    description:
      accountActive === true
        ? "Your account is active."
        : accountActive === false
          ? "Your account is not active. Contact support if you need help."
          : "Your account status is unavailable. Refresh and try again.",
    status: accountActive === true ? "verified" : "pending",
  };

  return (
    <div className="space-y-3">
      {[...items, accountItem].map((item) => {
        const isVerified = item.status === "verified" || item.status === "ready";
        const action = isVerified ? null : getVerificationAction(item);

        return (
          <div key={item.label} className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#E9F8EF] text-[#0A7A42]">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-black text-[#1F1A14]">{item.label}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-1 text-xs font-medium leading-5 text-[#6F6A62]">{item.description}</p>
              {action ? (
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="mt-2 h-8 rounded-lg border-[#D8C9B8] px-3 text-xs font-bold text-[#1F1A14] hover:bg-white"
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
