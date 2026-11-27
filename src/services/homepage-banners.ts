import { z } from "zod";
import { apiClient } from "@/services/api";

export const homepageBannerDestinations = ["products", "new-arrivals", "categories"] as const;
export const homepageBannerCopyLimits = { headline: 120, description: 300, ctaLabel: 40 } as const;
export const homepageBannerCopyShape = {
  headline: z.string().trim().min(1).max(homepageBannerCopyLimits.headline),
  description: z.string().trim().max(homepageBannerCopyLimits.description).nullable(),
  ctaLabel: z.string().trim().min(1).max(homepageBannerCopyLimits.ctaLabel),
};

// Reject generic, external, or traversal paths before the browser renders media.
export const campaignImagePathSchema = z.string().max(256).regex(
  /^\/images\/campaigns\/(?:[a-z0-9][a-z0-9_-]*\/)*[a-z0-9][a-z0-9_-]*\.(?:avif|webp|png|jpe?g)$/,
);

const publicBannerSchema = z.object({
  ...homepageBannerCopyShape,
  href: z.enum(["/products", "/new-arrivals", "/categories"]),
  mobileSrc: campaignImagePathSchema,
  desktopSrc: campaignImagePathSchema,
});
const responseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ banner: publicBannerSchema.nullable() }),
});

export type PublicHomepageBanner = z.infer<typeof publicBannerSchema>;

/** Optional editorial content must not hold up the storefront on an upstream timeout. */
export async function getHomepageBanner(): Promise<PublicHomepageBanner | null> {
  const response = await apiClient<unknown>("/content/homepage-banner", {
    authMode: "omit",
    cache: "no-store",
    timeout: 900,
  });
  return responseSchema.parse(response).data.banner;
}
