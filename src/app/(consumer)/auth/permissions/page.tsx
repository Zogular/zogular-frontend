"use client";

import { useEffect, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthLoadingSkeleton } from "@/components/auth/AuthLoadingSkeleton";
import {
  appendNextPath,
  getAuthRedirectIntent,
  sanitizeInternalNextPath,
} from "@/services/auth-intent";

export default function PermissionsPage() {
  return (
    <Suspense fallback={<AuthLoadingSkeleton />}>
      <PermissionsRedirect />
    </Suspense>
  );
}

function PermissionsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(
    () => sanitizeInternalNextPath(searchParams.get("next")) ?? getAuthRedirectIntent(),
    [searchParams],
  );

  useEffect(() => {
    router.replace(appendNextPath("/auth/check-email", nextPath));
  }, [nextPath, router]);

  return <AuthLoadingSkeleton />;
}
