"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRODUCT_CONTENT_POLICY_GUIDANCE,
  PRODUCT_SNAPSHOT_CONFLICT_GUIDANCE,
  type ProductContentPolicyIssue,
} from "@/services/product-content-policy";

type ProductContentPolicyFeedbackProps = {
  issues?: readonly ProductContentPolicyIssue[];
  hasSnapshotConflict?: boolean;
  onIssueSelect?: (issue: ProductContentPolicyIssue) => void;
  productHref?: (productId: string) => string;
  className?: string;
  feedbackId?: string;
};

export function ProductContentPolicyFeedback({
  issues = [],
  hasSnapshotConflict = false,
  onIssueSelect,
  productHref,
  className,
  feedbackId = "product-content-policy-feedback",
}: ProductContentPolicyFeedbackProps) {
  if (!issues.length && !hasSnapshotConflict) return null;

  const groupedIssues = groupIssuesByProduct(issues);
  const hasProductGroups = groupedIssues.some((group) => Boolean(group.productId));

  return (
    <div
      id={feedbackId}
      data-testid="product-content-policy-feedback"
      role="alert"
      tabIndex={-1}
      className={cn(
        "min-w-0 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-left shadow-sm",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        {hasSnapshotConflict ? (
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-rose-950">
            {hasSnapshotConflict ? "Reload before retrying" : "Update listing content"}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold leading-4 text-rose-800">
            {hasSnapshotConflict
              ? PRODUCT_SNAPSHOT_CONFLICT_GUIDANCE
              : PRODUCT_CONTENT_POLICY_GUIDANCE}
          </p>

          {!hasSnapshotConflict && issues.length ? (
            <div className="mt-2 space-y-2">
              {hasProductGroups
                ? groupedIssues.map((group) => (
                    <div key={group.productId ?? "unassigned"} className="rounded-lg border border-rose-200/80 bg-white/70 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[10px] font-black uppercase tracking-wide text-rose-900">
                          Product ID: {group.productId ?? "Unavailable"}
                        </p>
                        {group.productId && productHref ? (
                          <Link
                            href={productHref(group.productId)}
                            className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black text-rose-800 underline-offset-2 hover:underline"
                          >
                            Review
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        ) : null}
                      </div>
                      <IssueList issues={group.issues} onIssueSelect={onIssueSelect} />
                    </div>
                  ))
                : <IssueList issues={issues} onIssueSelect={onIssueSelect} />}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IssueList({
  issues,
  onIssueSelect,
}: {
  issues: readonly ProductContentPolicyIssue[];
  onIssueSelect?: (issue: ProductContentPolicyIssue) => void;
}) {
  const uniqueIssues = deduplicateIssueLabels(issues);

  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5" aria-label="Fields requiring changes">
      {uniqueIssues.map((issue) => (
        <li key={`${issue.productId ?? ""}:${issue.field}`}>
          {onIssueSelect ? (
            <button
              type="button"
              onClick={() => onIssueSelect(issue)}
              className="rounded-md border border-rose-200 bg-white px-2 py-1 text-[10px] font-black text-rose-800 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              {issue.label}
            </button>
          ) : (
            <span className="inline-flex rounded-md border border-rose-200 bg-white px-2 py-1 text-[10px] font-black text-rose-800">
              {issue.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function groupIssuesByProduct(issues: readonly ProductContentPolicyIssue[]) {
  const groups = new Map<string, ProductContentPolicyIssue[]>();

  for (const issue of issues) {
    const key = issue.productId ?? "";
    const current = groups.get(key) ?? [];
    current.push(issue);
    groups.set(key, current);
  }

  return Array.from(groups, ([productId, grouped]) => ({
    productId: productId || undefined,
    issues: grouped,
  }));
}

function deduplicateIssueLabels(issues: readonly ProductContentPolicyIssue[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.productId ?? ""}:${issue.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
