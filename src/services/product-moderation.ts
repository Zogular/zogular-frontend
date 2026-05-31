export type ProductModerationStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "needs_changes"
  | "published"
  | "paused"
  | "suspended";

export type ProductModerationAction = "approve" | "reject" | "request_changes";

// These fields are intentionally optional so the backend can evolve the
// moderation contract without the frontend locking in a permanent schema now.
export interface ProductModerationSignals {
  moderationFlags?: string[];
  moderationNotes?: string | null;
  riskScore?: number | null;
  duplicateWarnings?: string[];
  categorySuggestions?: string[];
  imageSafetyWarnings?: string[];
}

export interface ProductModerationState extends ProductModerationSignals {
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
}

export function getProductModerationStatusLabel(status: ProductModerationStatus): string {
  const labels: Record<ProductModerationStatus, string> = {
    draft: "Draft",
    pending_review: "Pending Review",
    approved: "Approved",
    rejected: "Rejected",
    needs_changes: "Needs Changes",
    published: "Published",
    paused: "Paused",
    suspended: "Suspended",
  };

  return labels[status];
}

export function getModerationActionTargetStatus(
  action: ProductModerationAction,
): Extract<ProductModerationStatus, "approved" | "rejected" | "needs_changes"> {
  if (action === "approve") return "approved";
  if (action === "reject") return "rejected";
  return "needs_changes";
}
