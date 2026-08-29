"use client";

import { motion, useReducedMotion } from "motion/react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { useAdminOverview } from "@/features/admin-overview/hooks/useAdminOverview";
import { isAdminOverviewEmpty } from "@/features/admin-overview/lib/overview-presentation";
import { MarketplaceSnapshot } from "@/features/admin-overview/components/MarketplaceSnapshot";
import { NeedsAttention } from "@/features/admin-overview/components/NeedsAttention";
import { OverviewHeader } from "@/features/admin-overview/components/OverviewHeader";
import {
  OverviewEmptyNotice,
  OverviewErrorState,
  OverviewLoading,
  RefreshFailureBanner,
} from "@/features/admin-overview/components/OverviewStates";
import { PrioritySummary } from "@/features/admin-overview/components/PrioritySummary";

export function AdminOverview({ nowIso }: { nowIso: string }) {
  const identity = useAdminIdentity();
  const reduceMotion = useReducedMotion();
  const {
    data,
    error,
    isInitialLoading,
    isRefreshing,
    liveMessage,
    refresh,
  } = useAdminOverview();

  const motionProps = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };

  const overviewAvailability = data
    ? data.priorities.availability === "AVAILABLE" &&
      data.snapshot.availability === "AVAILABLE"
      ? "AVAILABLE"
      : data.priorities.availability === "UNAVAILABLE" &&
          data.snapshot.availability === "UNAVAILABLE"
        ? "UNAVAILABLE"
        : "PARTIAL"
    : null;

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-10 sm:space-y-6">
      <OverviewHeader
        nowIso={nowIso}
        generatedAt={data?.generatedAt ?? null}
        availability={overviewAvailability}
        isRefreshing={isRefreshing}
        refreshDisabled={isInitialLoading || isRefreshing}
        onRefresh={() => void refresh()}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      {isInitialLoading ? <OverviewLoading /> : null}
      {!data && error ? <OverviewErrorState error={error} onRetry={() => void refresh()} /> : null}

      {data ? (
        <div className="space-y-5 sm:space-y-6">
          {error ? <RefreshFailureBanner error={error} onRetry={() => void refresh()} /> : null}
          {isAdminOverviewEmpty(data) ? <OverviewEmptyNotice /> : null}

          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.8fr)] xl:gap-5">
            <motion.div {...motionProps} className="min-w-0">
              {identity ? <NeedsAttention summary={data} identity={identity} /> : null}
            </motion.div>

            <motion.div
              {...motionProps}
              className="min-w-0"
              transition={reduceMotion ? undefined : { duration: 0.22, delay: 0.04, ease: "easeOut" }}
            >
              <PrioritySummary summary={data} />
            </motion.div>
          </div>

          <motion.div
            {...motionProps}
            transition={reduceMotion ? undefined : { duration: 0.22, delay: 0.08, ease: "easeOut" }}
          >
            <MarketplaceSnapshot summary={data} />
          </motion.div>
        </div>
      ) : null}
    </div>
  );
}
