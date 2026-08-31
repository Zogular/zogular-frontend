"use client";

import { motion, useReducedMotion } from "motion/react";
import { useAdminIdentity } from "@/components/admin/AdminShell";
import { MarketplacePulse } from "@/features/admin-overview/components/MarketplacePulse";
import { MarketplaceSnapshot } from "@/features/admin-overview/components/MarketplaceSnapshot";
import { NeedsAttention } from "@/features/admin-overview/components/NeedsAttention";
import { OperationalActivity } from "@/features/admin-overview/components/OperationalActivity";
import { OverviewControls } from "@/features/admin-overview/components/OverviewControls";
import { OverviewHeader } from "@/features/admin-overview/components/OverviewHeader";
import {
  OverviewEmptyNotice,
  OverviewErrorState,
  OverviewLoading,
  RefreshFailureBanner,
} from "@/features/admin-overview/components/OverviewStates";
import { useAdminOverview } from "@/features/admin-overview/hooks/useAdminOverview";
import { isAdminOverviewEmpty } from "@/features/admin-overview/lib/overview-presentation";
import type { AdminDashboardOverviewAvailability } from "@/features/admin-overview/types/dashboard-overview";

export function AdminOverview({ nowIso }: { nowIso: string }) {
  const identity = useAdminIdentity();
  const reduceMotion = useReducedMotion();
  const {
    data,
    error,
    freshness,
    isInitialLoading,
    isRefreshing,
    liveMessage,
    query,
    refresh,
    setGroupBy,
    setPeriod,
  } = useAdminOverview();

  const motionProps = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.22, ease: "easeOut" as const },
      };

  const overviewAvailability: AdminDashboardOverviewAvailability | null = data
    ? resolveOverviewAvailability([
        data.queues.availability,
        data.snapshot.availability,
        data.periodFlows.availability,
        data.operationalActivity.availability,
      ])
    : null;
  const executiveComposition = identity?.claims.role === "executive_admin";

  const queuePanel = data && identity ? (
    <motion.div {...motionProps} className="min-w-0">
      <NeedsAttention overview={data} identity={identity} />
    </motion.div>
  ) : null;
  const pulsePanel = data ? (
    <motion.div {...motionProps} className="min-w-0">
      <MarketplacePulse overview={data} />
    </motion.div>
  ) : null;
  const snapshotPanel = data ? (
    <motion.div {...motionProps} className="min-w-0">
      <MarketplaceSnapshot overview={data} />
    </motion.div>
  ) : null;
  const activityPanel = data ? (
    <motion.div {...motionProps} className="min-w-0">
      <OperationalActivity overview={data} />
    </motion.div>
  ) : null;

  return (
    <div className="mx-auto w-full max-w-[90rem] space-y-5 pb-10 sm:space-y-6">
      <OverviewHeader
        nowIso={nowIso}
        generatedAt={data?.generatedAt ?? null}
        availability={overviewAvailability}
        freshness={freshness}
        period={query.period}
        groupBy={query.groupBy}
        isRefreshing={isRefreshing}
        refreshDisabled={isInitialLoading || isRefreshing}
        onRefresh={() => void refresh()}
      />

      <OverviewControls
        period={query.period}
        groupBy={query.groupBy}
        onPeriodChange={setPeriod}
        onGroupByChange={setGroupBy}
        disabled={isInitialLoading}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </p>

      {isInitialLoading ? <OverviewLoading /> : null}
      {!data && error ? (
        <OverviewErrorState error={error} onRetry={() => void refresh()} />
      ) : null}

      {data ? (
        <div className="space-y-5 sm:space-y-6" data-testid="overview-content">
          {error ? (
            <RefreshFailureBanner error={error} onRetry={() => void refresh()} />
          ) : null}
          {isAdminOverviewEmpty(data) ? <OverviewEmptyNotice /> : null}

          {executiveComposition ? (
            <>
              {pulsePanel}
              {activityPanel}
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:gap-5">
                {queuePanel}
                {snapshotPanel}
              </div>
            </>
          ) : (
            <>
              <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)] xl:gap-5">
                {queuePanel}
                {pulsePanel}
              </div>
              {snapshotPanel}
              {activityPanel}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function resolveOverviewAvailability(
  sections: readonly AdminDashboardOverviewAvailability[],
): AdminDashboardOverviewAvailability {
  if (sections.every((availability) => availability === "AVAILABLE")) {
    return "AVAILABLE";
  }
  if (sections.every((availability) => availability === "UNAVAILABLE")) {
    return "UNAVAILABLE";
  }
  return "PARTIAL";
}
