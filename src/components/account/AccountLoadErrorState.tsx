"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FeedbackState } from "@/components/states/FeedbackState";
import { Button } from "@/components/ui/button";
import { appendNextPath } from "@/services/auth-intent";
import {
  getAccountErrorPresentation,
  type AccountResource,
} from "@/lib/account-error";

interface AccountLoadErrorStateProps {
  error: unknown;
  resource: AccountResource;
  onRetry: () => void | Promise<void>;
  secondaryAction?: { href: string; label: string };
}

export function AccountLoadErrorState({ error, resource, onRetry, secondaryAction }: AccountLoadErrorStateProps) {
  const pathname = usePathname();
  const router = useRouter();
  const presentation = getAccountErrorPresentation(error, resource);

  return (
    <FeedbackState
      icon={AlertCircle}
      tone="danger"
      title={presentation.title}
      description={presentation.description}
      action={
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {presentation.kind === "sign-in" ? (
            <Button
              onClick={() => router.replace(appendNextPath("/auth/login", pathname))}
              className="bg-zinc-900 text-white hover:bg-zinc-800"
            >
              Sign in
            </Button>
          ) : (
            <Button
              onClick={() => void onRetry()}
              variant="outline"
              className="border-red-200 text-red-700 hover:bg-red-100"
            >
              Try Again
            </Button>
          )}
          {secondaryAction ? (
            <Button asChild variant="ghost">
              <Link href={secondaryAction.href}>{secondaryAction.label}</Link>
            </Button>
          ) : null}
        </div>
      }
    />
  );
}
