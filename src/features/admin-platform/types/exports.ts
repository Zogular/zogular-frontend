import { z } from "zod";
import { AdminCapabilityIdSchema } from "./capabilities";
import { SafeAdminErrorSchema } from "./errors";

export const ADMIN_EXPORT_CONTRACT_VERSION = 1 as const;

const TimestampSchema = z.iso.datetime({ offset: true });

export const AdminExportScopeSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("current_view"),
    queryFingerprint: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
  }),
  z.strictObject({
    kind: z.literal("filtered_result"),
    queryFingerprint: z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/),
  }),
  z.strictObject({ kind: z.literal("all_authorized") }),
]);

export const AdminExportRequestSchema = z.strictObject({
  version: z.literal(ADMIN_EXPORT_CONTRACT_VERSION),
  ownership: z.literal("backend"),
  requestId: z.string().min(1).max(128),
  capabilityId: AdminCapabilityIdSchema,
  scope: AdminExportScopeSchema,
  format: z.enum(["csv", "xlsx", "json"]),
  requestedAt: TimestampSchema,
  permissionState: z.literal("allowed"),
});

export const AdminExportJobSchema = z
  .strictObject({
    version: z.literal(ADMIN_EXPORT_CONTRACT_VERSION),
    ownership: z.literal("backend"),
    requestId: z.string().min(1).max(128),
    jobId: z.string().min(1).max(128),
    state: z.enum(["queued", "processing", "completed", "failed", "expired"]),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    completedAt: TimestampSchema.nullable(),
    expiresAt: TimestampSchema.nullable(),
    downloadUrl: z
      .string()
      .url()
      .max(2_000)
      .refine((value) => value.startsWith("https://"), "Export downloads must use HTTPS.")
      .nullable(),
    error: SafeAdminErrorSchema.nullable(),
    permissionState: z.enum(["allowed", "forbidden", "unknown"]),
  })
  .superRefine((value, context) => {
    const createdAt = Date.parse(value.createdAt);
    const updatedAt = Date.parse(value.updatedAt);
    const completedAt = value.completedAt === null ? null : Date.parse(value.completedAt);
    const expiresAt = value.expiresAt === null ? null : Date.parse(value.expiresAt);

    if (updatedAt < createdAt) {
      context.addIssue({
        code: "custom",
        path: ["updatedAt"],
        message: "Export update time cannot be earlier than creation time.",
      });
    }
    if (value.permissionState !== "allowed") {
      context.addIssue({
        code: "custom",
        path: ["permissionState"],
        message: "Export jobs cannot expose state without confirmed permission.",
      });
    }
    if (value.state === "completed") {
      if (
        value.downloadUrl === null ||
        completedAt === null ||
        expiresAt === null ||
        value.error !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Completed exports require completion, an active expiring download, and no error.",
        });
      } else {
        if (completedAt < createdAt || completedAt > updatedAt) {
          context.addIssue({
            code: "custom",
            path: ["completedAt"],
            message: "Export completion time must be within the recorded job lifetime.",
          });
        }
        if (expiresAt <= completedAt || expiresAt <= updatedAt) {
          context.addIssue({
            code: "custom",
            path: ["expiresAt"],
            message: "A completed export download must expire after completion and the current update.",
          });
        }
      }
      return;
    }
    if (value.downloadUrl !== null) {
      context.addIssue({
        code: "custom",
        path: ["downloadUrl"],
        message: "Only completed exports can expose a download URL.",
      });
    }
    if (value.state === "expired") {
      if (completedAt === null || expiresAt === null || value.error !== null) {
        context.addIssue({
          code: "custom",
          path: ["state"],
          message: "Expired exports require prior completion and expiry timestamps with no error.",
        });
      } else {
        if (completedAt < createdAt || expiresAt <= completedAt) {
          context.addIssue({
            code: "custom",
            path: ["completedAt"],
            message: "Expired export timestamps must follow creation, completion, then expiry.",
          });
        }
        if (updatedAt < expiresAt) {
          context.addIssue({
            code: "custom",
            path: ["updatedAt"],
            message: "An expired export must be observed at or after its expiry time.",
          });
        }
      }
      return;
    }
    if (completedAt !== null || expiresAt !== null) {
      context.addIssue({
        code: "custom",
        path: ["completedAt"],
        message: "Only completed or expired exports can carry completion and expiry timestamps.",
      });
    }
    if (value.state === "failed" && value.error === null) {
      context.addIssue({ code: "custom", path: ["error"], message: "Failed exports require a safe error." });
    }
    if (value.state !== "failed" && value.error !== null) {
      context.addIssue({
        code: "custom",
        path: ["error"],
        message: "Only failed exports can include an error.",
      });
    }
  });

export type AdminExportRequest = z.infer<typeof AdminExportRequestSchema>;
export type AdminExportJob = z.infer<typeof AdminExportJobSchema>;
