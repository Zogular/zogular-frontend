import { z } from "zod";
import { AdminLinkedEntitySchema } from "./entities";

export const ADMIN_COLLABORATION_CONTRACT_VERSION = 1 as const;
export const ADMIN_AUDIT_SUMMARY_CONTRACT_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime({ offset: true });
const BackendOwnedFields = {
  version: z.literal(ADMIN_COLLABORATION_CONTRACT_VERSION),
  ownership: z.literal("backend"),
} as const;

export const AdminWorkOwnerSchema = z.strictObject({
  type: z.enum(["admin", "team"]),
  id: z.string().min(1).max(128),
  maskedLabel: z.string().min(1).max(160),
});

export const AdminAssignmentSchema = z
  .strictObject({
    ...BackendOwnedFields,
    id: z.string().min(1).max(128),
    entity: AdminLinkedEntitySchema,
    assignee: AdminWorkOwnerSchema,
    priority: z.enum(["low", "normal", "high", "urgent"]),
    status: z.enum(["active", "released"]),
    assignedAt: TimestampSchema,
    dueAt: TimestampSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (value.dueAt !== null && Date.parse(value.dueAt) < Date.parse(value.assignedAt)) {
      context.addIssue({
        code: "custom",
        path: ["dueAt"],
        message: "Assignment due time cannot be earlier than assignment time.",
      });
    }
  });

export const AdminHandoffSchema = z
  .strictObject({
    ...BackendOwnedFields,
    id: z.string().min(1).max(128),
    entity: AdminLinkedEntitySchema,
    from: AdminWorkOwnerSchema,
    to: AdminWorkOwnerSchema,
    reason: z.string().min(1).max(1_000),
    handedOffAt: TimestampSchema,
  })
  .superRefine((value, context) => {
    if (value.from.type === value.to.type && value.from.id === value.to.id) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "A handoff must transfer work to a different owner.",
      });
    }
  });

export const AdminInternalNoteSchema = z
  .strictObject({
    ...BackendOwnedFields,
    id: z.string().min(1).max(128),
    entity: AdminLinkedEntitySchema,
    author: AdminWorkOwnerSchema,
    body: z.string().min(1).max(10_000),
    visibility: z.literal("internal_only"),
    createdAt: TimestampSchema,
    editedAt: TimestampSchema.nullable(),
  })
  .superRefine((value, context) => {
    if (value.editedAt !== null && Date.parse(value.editedAt) < Date.parse(value.createdAt)) {
      context.addIssue({
        code: "custom",
        path: ["editedAt"],
        message: "Internal note edit time cannot be earlier than creation time.",
      });
    }
  });

export const AdminAuditSummarySchema = z.strictObject({
  version: z.literal(ADMIN_AUDIT_SUMMARY_CONTRACT_VERSION),
  ownership: z.literal("backend"),
  id: z.string().min(1).max(128),
  actor: AdminWorkOwnerSchema,
  action: z.string().min(1).max(120).regex(/^[A-Z][A-Z0-9_]*$/),
  actionLabel: z.string().min(1).max(160),
  entity: AdminLinkedEntitySchema,
  occurredAt: TimestampSchema,
  reasonSummary: z.string().min(1).max(500).nullable(),
  detailsVisibility: z.enum(["available", "masked", "forbidden"]),
});

export type AdminAssignment = z.infer<typeof AdminAssignmentSchema>;
export type AdminHandoff = z.infer<typeof AdminHandoffSchema>;
export type AdminInternalNote = z.infer<typeof AdminInternalNoteSchema>;
export type AdminAuditSummary = z.infer<typeof AdminAuditSummarySchema>;
