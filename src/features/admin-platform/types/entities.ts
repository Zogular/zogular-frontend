import { z } from "zod";

export const ADMIN_ENTITY_LINK_CONTRACT_VERSION = 1 as const;

export const AdminEntityTypeSchema = z.enum([
  "seller",
  "customer",
  "product",
  "category",
  "order",
  "support_ticket",
  "case",
  "admin",
]);

export const AdminLinkedEntitySchema = z
  .strictObject({
    version: z.literal(ADMIN_ENTITY_LINK_CONTRACT_VERSION),
    type: AdminEntityTypeSchema,
    id: z.string().min(1).max(128),
    maskedLabel: z.string().min(1).max(160),
    route: z
      .string()
      .min(1)
      .max(200)
      .regex(/^\/admin(?:\/[a-z0-9-]+)*$/)
      .nullable(),
    visibility: z.enum(["visible", "masked", "forbidden"]),
  })
  .superRefine((value, context) => {
    if (value.visibility === "forbidden" && value.route !== null) {
      context.addIssue({
        code: "custom",
        path: ["route"],
        message: "Forbidden linked entities cannot expose a route.",
      });
    }
    if (value.visibility !== "forbidden" && value.route === null) {
      context.addIssue({
        code: "custom",
        path: ["route"],
        message: "Visible linked entities require a permitted route.",
      });
    }
  });

export type AdminEntityType = z.infer<typeof AdminEntityTypeSchema>;
export type AdminLinkedEntity = z.infer<typeof AdminLinkedEntitySchema>;
