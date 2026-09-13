"use client";

/**
 * @file BuyerDetailSheet.tsx
 * @module features/admin-buyers/sections
 * @description
 * Slide-over drawer presenting comprehensive customer detail including identity snapshot,
 * verification status, order count and total spend metrics, recent orders, saved addresses,
 * and account governance action triggers (activate/deactivate), styled with the Zogular
 * warm admin aesthetic palette.
 */

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  Ticket,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  formatAdminCurrency,
  formatAdminDate,
  formatAdminDateTime,
  toTitleCase,
} from "@/lib/admin-format";
import type {
  AdminBuyerRecord,
  CustomerLinkedContext,
  BuyerDetailTab,
} from "../types/admin-buyer.types";

export interface BuyerDetailSheetProps {
  buyer: AdminBuyerRecord | null;
  context?: CustomerLinkedContext;
  isLoadingContext: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenStatusDialog: (buyer: AdminBuyerRecord, nextStatus: boolean) => void;
}

/**
 * Render visual star score rating (1 - 5 stars)
 */
function renderStarRating(rating: number) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`size-3.5 ${
            star <= Math.round(rating)
              ? "fill-amber-400 text-amber-500"
              : "fill-transparent text-[var(--admin-copper-muted)] opacity-40"
          }`}
        />
      ))}
    </div>
  );
}

/**
 * Compute customer segment based on spend, order volume, and 30-day lifecycle rule.
 * - totalSpend > 5000 or orderCount >= 10 -> VIP
 * - orderCount >= 1 -> ACTIVE_SHOPPER
 * - orderCount === 0:
 *     - If created within 30 days -> NEW_CUSTOMER
 *     - If > 30 days and 0 orders -> null (omit badge)
 */
function getCustomerSegment(
  buyer: AdminBuyerRecord,
  context?: CustomerLinkedContext,
): "VIP" | "ACTIVE_SHOPPER" | "NEW_CUSTOMER" | null {
  const totalSpend = context?.totalSpend ?? 0;
  const orderCount = context?.orderCount ?? 0;

  if (totalSpend > 5000 || orderCount >= 10) {
    return "VIP";
  }
  if (orderCount >= 1) {
    return "ACTIVE_SHOPPER";
  }
  if (orderCount === 0) {
    if (buyer.createdAt) {
      const createdMs = new Date(buyer.createdAt).getTime();
      if (!Number.isNaN(createdMs)) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        if (Date.now() - createdMs <= thirtyDaysMs) {
          return "NEW_CUSTOMER";
        }
      }
    }
    return null;
  }
  return null;
}

/**
 * Render dynamic segment pill badge
 */
function renderSegmentBadge(segment: "VIP" | "ACTIVE_SHOPPER" | "NEW_CUSTOMER" | null) {
  if (!segment) return null;
  if (segment === "VIP") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200">
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
        VIP Customer
      </span>
    );
  }
  if (segment === "ACTIVE_SHOPPER") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-200">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Active Shopper
      </span>
    );
  }
  if (segment === "NEW_CUSTOMER") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-950/80 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-sky-200">
        <span className="size-1.5 rounded-full bg-sky-400" />
        New Customer
      </span>
    );
  }
  return null;
}

/**
 * Render ticket priority badge with tactile styling
 */
function renderPriorityBadge(priority: string) {
  const p = priority.toUpperCase();
  if (p === "URGENT" || p === "HIGH") {
    return (
      <span className="rounded border border-rose-600/30 bg-rose-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-rose-800">
        {priority}
      </span>
    );
  }
  if (p === "MEDIUM") {
    return (
      <span className="rounded border border-amber-600/30 bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-800">
        {priority}
      </span>
    );
  }
  return (
    <span className="rounded border border-[color-mix(in_srgb,var(--admin-copper-muted)_30%,transparent)] bg-[var(--admin-surface-mist)] px-1.5 py-0.5 text-[9px] font-black uppercase text-[var(--admin-ink-soft)]">
      {priority}
    </span>
  );
}

export function BuyerDetailSheet({
  buyer,
  context,
  isLoadingContext,
  isOpen,
  onOpenChange,
  onOpenStatusDialog,
}: BuyerDetailSheetProps) {
  const [activeTab, setActiveTab] = useState<BuyerDetailTab>("overview");

  if (!buyer) return null;

  const fullName =
    [buyer.firstName, buyer.lastName].filter(Boolean).join(" ") || "Unnamed Customer";
  const emailVerified = buyer.emailVerified;
  const phoneVerified = Boolean(buyer.phoneVerified || buyer.phoneVerifiedAt);
  const segment = getCustomerSegment(buyer, context);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col border-l border-[var(--admin-copper-muted)]/30 bg-[#fff8ec] dark:bg-[#171a16] p-0 text-[var(--admin-ink)] shadow-2xl sm:max-w-xl">
        <SheetHeader className="border-b border-[color:rgba(255,248,236,0.12)] bg-[var(--admin-canopy-deep)] p-6 text-[var(--admin-surface-cream)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl font-black text-[var(--admin-surface-cream)]">
                {fullName}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs font-semibold text-[var(--admin-surface-mist)]/85">
                {buyer.email ?? "No email"} &middot;{" "}
                {buyer.isActive ? "Active Account" : "Deactivated Account"}
              </SheetDescription>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {renderSegmentBadge(segment)}
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  buyer.isActive
                    ? "border-emerald-400/40 bg-emerald-950/80 text-emerald-200"
                    : "border-rose-400/40 bg-rose-950/80 text-rose-200"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${buyer.isActive ? "bg-emerald-400" : "bg-rose-400"}`}
                />
                {buyer.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </SheetHeader>

        {/* Tab Navigation - Compact, fluid, zero horizontal scrollbar */}
        <div className="flex border-b border-[var(--admin-copper-muted)]/20 bg-[var(--admin-surface-mist)] px-6 pt-1.5 scrollbar-none overflow-x-hidden [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-black transition-colors ${
              activeTab === "overview"
                ? "border-[var(--admin-canopy-deep)] text-[var(--admin-canopy-deep)]"
                : "border-transparent text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <UserCheck className="size-3.5" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-black transition-colors ${
              activeTab === "orders"
                ? "border-[var(--admin-canopy-deep)] text-[var(--admin-canopy-deep)]"
                : "border-transparent text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <ShoppingBag className="size-3.5" />
            <span>Orders</span>
            {context ? (
              <span className="ml-1 rounded-full bg-[var(--admin-surface-cream)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--admin-canopy-deep)]">
                {context.orderCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("reviews")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-black transition-colors ${
              activeTab === "reviews"
                ? "border-[var(--admin-canopy-deep)] text-[var(--admin-canopy-deep)]"
                : "border-transparent text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <Star className="size-3.5" />
            <span>Reviews</span>
            {context?.reviewSummary ? (
              <span className="ml-1 rounded-full bg-[var(--admin-surface-cream)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--admin-canopy-deep)]">
                {context.reviewSummary.count}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-black transition-colors ${
              activeTab === "tickets"
                ? "border-[var(--admin-canopy-deep)] text-[var(--admin-canopy-deep)]"
                : "border-transparent text-[var(--admin-ink-soft)] hover:text-[var(--admin-ink)]"
            }`}
          >
            <Ticket className="size-3.5" />
            <span>Support</span>
            {context?.supportTickets && context.supportTickets.length > 0 ? (
              <span className="ml-1 rounded-full bg-[var(--admin-surface-cream)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--admin-canopy-deep)]">
                {context.supportTickets.length}
              </span>
            ) : null}
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overflow-x-hidden scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] p-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Identity Snapshot Card */}
              <div className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ember)]">
                    Identity Snapshot
                  </h3>
                  {renderSegmentBadge(segment)}
                </div>
                <div className="mt-3.5 grid gap-2.5 text-sm text-[var(--admin-ink)] font-medium">
                  <div className="flex justify-between border-b border-[var(--admin-copper-muted)]/15 pb-2.5">
                    <span className="text-[var(--admin-ink-soft)]">Customer Name</span>
                    <span className="font-black text-[var(--admin-canopy-deep)]">{fullName}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--admin-copper-muted)]/15 pb-2.5">
                    <span className="text-[var(--admin-ink-soft)]">Email Address</span>
                    <span className="font-bold text-[var(--admin-ink)]">{buyer.email ?? "Not recorded"}</span>
                  </div>
                  <div className="flex justify-between border-b border-[var(--admin-copper-muted)]/15 pb-2.5">
                    <span className="text-[var(--admin-ink-soft)]">Phone Number</span>
                    <span className="font-bold text-[var(--admin-ink)]">{buyer.telephone ?? "Not recorded"}</span>
                  </div>
                  <div className="flex justify-between pt-0.5">
                    <span className="text-[var(--admin-ink-soft)]">Member Since</span>
                    <span className="font-bold text-[var(--admin-ink)]" suppressHydrationWarning>
                      {formatAdminDateTime(buyer.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Verification Status Card */}
              <div className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-5 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ember)]">
                  Verification Status
                </h3>
                <div className="mt-3.5 grid grid-cols-2 gap-3">
                  <div
                    className={`flex items-center gap-3 rounded-xl p-3.5 transition-all ${
                      emailVerified
                        ? "border border-emerald-600/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                        : "border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-cream)] text-[var(--admin-ink-soft)]"
                    }`}
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-black text-white ${
                        emailVerified
                          ? "bg-emerald-700"
                          : "border border-[var(--admin-copper-muted)]/20 bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                      }`}
                    >
                      {emailVerified ? "✓" : "–"}
                    </div>
                    <div>
                      <p className="text-xs font-black">{emailVerified ? "Email Verified" : "Email Pending"}</p>
                      <p className="text-[10px] font-semibold opacity-80" suppressHydrationWarning>
                        {buyer.emailVerifiedAt ? formatAdminDate(buyer.emailVerifiedAt) : "Not verified"}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`flex items-center gap-3 rounded-xl p-3.5 transition-all ${
                      phoneVerified
                        ? "border border-sky-600/20 bg-sky-500/10 text-sky-900 dark:text-sky-200"
                        : "border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-cream)] text-[var(--admin-ink-soft)]"
                    }`}
                  >
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-lg font-black text-white ${
                        phoneVerified
                          ? "bg-sky-700"
                          : "border border-[var(--admin-copper-muted)]/20 bg-[var(--admin-surface-mist)] text-[var(--admin-ink-soft)]"
                      }`}
                    >
                      {phoneVerified ? "✓" : "–"}
                    </div>
                    <div>
                      <p className="text-xs font-black">{phoneVerified ? "Phone Verified" : "Phone Pending"}</p>
                      <p className="text-[10px] font-semibold opacity-80" suppressHydrationWarning>
                        {buyer.phoneVerifiedAt ? formatAdminDate(buyer.phoneVerifiedAt) : "Not verified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Saved Addresses Card */}
              <div className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-5 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-ember)]">
                  Saved Addresses
                </h3>
                {isLoadingContext ? (
                  <div className="mt-3 flex items-center justify-center p-6">
                    <RefreshCw className="size-5 animate-spin text-[var(--admin-canopy)]" />
                    <span className="ml-2 text-xs font-bold text-[var(--admin-ink-soft)]">
                      Loading addresses...
                    </span>
                  </div>
                ) : context && context.addresses.length > 0 ? (
                  <div className="mt-3.5 space-y-2.5">
                    {context.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="rounded-xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-cream)] p-3.5 text-xs shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-black text-[var(--admin-canopy-deep)]">{addr.title}</p>
                          {addr.isDefault && (
                            <span className="rounded-md border border-emerald-600/30 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                              Default
                            </span>
                          )}
                        </div>
                        {addr.addressLine && (
                          <p className="mt-1 text-[var(--admin-ink)] font-semibold">{addr.addressLine}</p>
                        )}
                        <p className="text-[var(--admin-ink-soft)] font-medium">
                          {[addr.district, addr.city].filter(Boolean).join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3.5 rounded-xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-cream)] p-4 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                    No saved shipping addresses on file.
                  </p>
                )}
              </div>

              {/* Account Governance Action */}
              <div className="rounded-2xl border border-[var(--admin-copper-muted)]/20 bg-[var(--admin-surface-cream)] p-5 shadow-xs">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--admin-canopy-deep)]">
                  Account Governance
                </h3>
                <p className="mt-1 text-xs text-[var(--admin-ink-soft)] font-semibold">
                  Administrative status changes revoke active authentication tokens and are audited.
                </p>
                <div className="mt-4">
                  {buyer.isActive ? (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => onOpenStatusDialog(buyer, false)}
                      className="w-full rounded-xl bg-rose-700 font-black text-white hover:bg-rose-800"
                    >
                      <ShieldAlert className="mr-2 size-4" />
                      Deactivate Customer Account
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() => onOpenStatusDialog(buyer, true)}
                      className="w-full rounded-xl bg-[var(--admin-canopy-deep)] font-black text-[var(--admin-surface-cream)] hover:bg-[var(--admin-canopy)]"
                    >
                      <ShieldCheck className="mr-2 size-4" />
                      Reactivate Customer Account
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              {isLoadingContext ? (
                <div className="flex items-center justify-center p-10">
                  <RefreshCw className="size-5 animate-spin text-[var(--admin-canopy)]" />
                  <span className="ml-2 text-xs font-bold text-[var(--admin-ink-soft)]">
                    Loading order activity...
                  </span>
                </div>
              ) : context ? (
                <>
                  {/* Metrics Row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-4 shadow-xs">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]">
                        Total Orders
                      </p>
                      <p className="mt-1 text-2xl font-black text-[var(--admin-canopy-deep)]">
                        {context.orderCount}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-4 shadow-xs">
                      <p className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]">
                        Total Spend
                      </p>
                      <p className="mt-1 text-2xl font-black text-[var(--admin-canopy-deep)]">
                        {formatAdminCurrency(context.totalSpend)}
                      </p>
                    </div>
                  </div>

                  {/* Orders List */}
                  <div>
                    <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-[var(--admin-ember)]">
                      Recent Orders
                    </h3>
                    {context.recentOrders.length > 0 ? (
                      <div className="divide-y divide-[var(--admin-copper-muted)]/15 rounded-2xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-mist)]/80 overflow-hidden shadow-xs">
                        {context.recentOrders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between p-4 text-xs transition-colors hover:bg-[var(--admin-surface-cream)]"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-black text-[var(--admin-canopy-deep)]">
                                  {order.orderNumber}
                                </p>
                                <Link
                                  href={`/admin/orders/${order.id}`}
                                  className="text-[var(--admin-ember)] hover:text-[var(--admin-canopy-deep)] transition-colors"
                                  title="View Order in Admin"
                                >
                                  <ExternalLink className="size-3" />
                                </Link>
                              </div>
                              <p
                                className="mt-0.5 text-[10px] font-semibold text-[var(--admin-ink-soft)]"
                                suppressHydrationWarning
                              >
                                {formatAdminDateTime(order.createdAt)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-[var(--admin-ink)]">
                                {formatAdminCurrency(
                                  order.grandTotalAmount ?? order.totalAmount ?? 0,
                                )}
                              </p>
                              <span className="mt-1 inline-block rounded-md border border-[var(--admin-copper-muted)]/25 bg-[var(--admin-surface-cream)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--admin-ink)]">
                                {toTitleCase(order.status)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-mist)]/80 p-6 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                        No orders placed yet.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-6 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                  Order context is not available for this account.
                </p>
              )}
            </div>
          )}

          {/* TAB 3: REVIEWS */}
          {activeTab === "reviews" && (
            <div className="space-y-4">
              {isLoadingContext ? (
                <div className="flex items-center justify-center p-10">
                  <RefreshCw className="size-5 animate-spin text-[var(--admin-canopy)]" />
                  <span className="ml-2 text-xs font-bold text-[var(--admin-ink-soft)]">
                    Loading customer reviews...
                  </span>
                </div>
              ) : context ? (
                <>
                  {/* Reviews Summary Card */}
                  <div className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-4 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[var(--admin-ink-soft)]">
                          Customer Rating Profile
                        </p>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-[var(--admin-canopy-deep)]">
                            {context.reviewSummary?.avgRating
                              ? context.reviewSummary.avgRating.toFixed(1)
                              : "—"}
                          </span>
                          <span className="text-xs font-semibold text-[var(--admin-ink-soft)]">
                            out of 5.0
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {context.reviewSummary?.avgRating ? (
                          renderStarRating(context.reviewSummary.avgRating)
                        ) : null}
                        <p className="mt-1 text-[10px] font-bold text-[var(--admin-ink-soft)]">
                          {context.reviewSummary?.count ?? 0} total reviews
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Reviews List */}
                  <div>
                    <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-[var(--admin-ember)]">
                      Recent Reviews
                    </h3>
                    {context.reviews && context.reviews.length > 0 ? (
                      <div className="space-y-3">
                        {context.reviews.map((rev) => (
                          <div
                            key={rev.id}
                            className="rounded-2xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-mist)]/80 p-4 shadow-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-black text-sm text-[var(--admin-canopy-deep)]">
                                  {rev.product?.name ?? "Product"}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  {renderStarRating(rev.rating)}
                                  <span className="text-[10px] font-black text-[var(--admin-ink)]">
                                    {rev.rating}.0
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                    rev.status === "APPROVED"
                                      ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                                      : rev.status === "REJECTED"
                                      ? "border border-rose-600/30 bg-rose-50 text-rose-800"
                                      : "border border-amber-600/30 bg-amber-50 text-amber-800"
                                  }`}
                                >
                                  {rev.status}
                                </span>
                                {rev.isVerified && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700">
                                    <CheckCircle2 className="size-2.5" /> Verified Purchase
                                  </span>
                                )}
                              </div>
                            </div>
                            {rev.comment && (
                              <p className="mt-2.5 rounded-xl border border-[var(--admin-copper-muted)]/10 bg-[var(--admin-surface-cream)] p-3 text-xs text-[var(--admin-ink)] font-medium leading-relaxed">
                                &ldquo;{rev.comment}&rdquo;
                              </p>
                            )}
                            <p
                              className="mt-2 text-[10px] font-semibold text-[var(--admin-ink-soft)]"
                              suppressHydrationWarning
                            >
                              Reviewed on {formatAdminDate(rev.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-2xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-mist)]/80 p-6 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                        No reviews submitted by this customer.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-6 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                  Review history is not available.
                </p>
              )}
            </div>
          )}

          {/* TAB 4: SUPPORT TICKETS */}
          {activeTab === "tickets" && (
            <div className="space-y-4">
              {isLoadingContext ? (
                <div className="flex items-center justify-center p-10">
                  <RefreshCw className="size-5 animate-spin text-[var(--admin-canopy)]" />
                  <span className="ml-2 text-xs font-bold text-[var(--admin-ink-soft)]">
                    Loading support tickets...
                  </span>
                </div>
              ) : context ? (
                <div>
                  <h3 className="mb-2.5 text-xs font-black uppercase tracking-wider text-[var(--admin-ember)]">
                    Recent Support Tickets
                  </h3>
                  {context.supportTickets && context.supportTickets.length > 0 ? (
                    <div className="space-y-3">
                      {context.supportTickets.map((ticket) => (
                        <div
                          key={ticket.id}
                          className="rounded-2xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-mist)]/80 p-4 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-black text-sm text-[var(--admin-canopy-deep)]">
                                {ticket.subject}
                              </p>
                              <p className="mt-0.5 text-[10px] font-bold text-[var(--admin-ink-soft)]">
                                Category: {toTitleCase(ticket.category)}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {renderPriorityBadge(ticket.priority)}
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                                  ticket.status === "RESOLVED" || ticket.status === "CLOSED"
                                    ? "border border-emerald-600/30 bg-emerald-50 text-emerald-800"
                                    : ticket.status === "IN_PROGRESS"
                                    ? "border border-sky-600/30 bg-sky-50 text-sky-800"
                                    : "border border-amber-600/30 bg-amber-50 text-amber-800"
                                }`}
                              >
                                {ticket.status}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-[var(--admin-copper-muted)]/15 pt-2 text-[10px] font-semibold text-[var(--admin-ink-soft)]">
                            <span suppressHydrationWarning>
                              Created: {formatAdminDateTime(ticket.createdAt)}
                            </span>
                            {ticket.resolvedAt ? (
                              <span suppressHydrationWarning className="text-emerald-700 font-bold">
                                Resolved: {formatAdminDate(ticket.resolvedAt)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-[var(--admin-copper-muted)]/15 bg-[var(--admin-surface-mist)]/80 p-6 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                      No support tickets logged for this customer.
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl bg-[var(--admin-surface-mist)]/80 p-6 text-center text-xs font-semibold text-[var(--admin-ink-soft)]">
                  Support ticket context is not available.
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
