import { z } from "zod";
import { apiClient } from "@/services/api";
import { campaignImagePathSchema, homepageBannerCopyShape, homepageBannerDestinations } from "@/services/homepage-banners";

const endpoint = "/admin/content/homepage-banners";
const destinationSchema = z.enum(homepageBannerDestinations);
const bannerFields = z.object({
  ...homepageBannerCopyShape,
  destination: destinationSchema,
  assetKey: z.string().min(1),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
});
const adminBannerSchema = bannerFields.extend({
  id: z.string().min(1),
  state: z.enum(["DRAFT", "PUBLISHED", "PAUSED"]),
  version: z.number().int().nonnegative(),
});
const campaignAssetSchema = z.object({
  key: z.string().min(1),
  mobileSrc: campaignImagePathSchema,
  desktopSrc: campaignImagePathSchema,
});
const listResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ items: z.array(adminBannerSchema), assets: z.array(campaignAssetSchema) }),
});
const mutationResponseSchema = z.object({
  status: z.literal("success"),
  data: z.object({ banner: adminBannerSchema }),
});

export type HomepageBannerInput = z.infer<typeof bannerFields>;
export type AdminHomepageBanner = z.infer<typeof adminBannerSchema>;
export type HomepageBannerAsset = z.infer<typeof campaignAssetSchema>;

async function writeBanner(path: string, method: "POST" | "PATCH", input: object) {
  const response = await apiClient<unknown>(path, {
    method,
    body: JSON.stringify(input),
    csrf: true,
    cache: "no-store",
  });
  return mutationResponseSchema.parse(response).data.banner;
}

function confirmWrite(banner: AdminHomepageBanner, expected: {
  state: AdminHomepageBanner["state"];
  id?: string;
  previousVersion?: number;
}) {
  if (banner.state !== expected.state || (expected.id && banner.id !== expected.id)
    || (expected.previousVersion !== undefined && banner.version <= expected.previousVersion)) {
    throw new Error("Unexpected homepage banner mutation response.");
  }
  return banner;
}

export const adminContentApi = {
  async listHomepageBanners(signal?: AbortSignal) {
    const response = await apiClient<unknown>(endpoint, { cache: "no-store", signal });
    return listResponseSchema.parse(response).data;
  },
  async createHomepageBanner(input: HomepageBannerInput) {
    return confirmWrite(await writeBanner(endpoint, "POST", input), { state: "DRAFT" });
  },
  async updateHomepageBanner(id: string, version: number, input: HomepageBannerInput) {
    const banner = await writeBanner(`${endpoint}/${encodeURIComponent(id)}`, "PATCH", { ...input, version });
    return confirmWrite(banner, { id, previousVersion: version, state: "DRAFT" });
  },
  async changeHomepageBannerState(id: string, version: number, action: "publish" | "pause") {
    const banner = await writeBanner(`${endpoint}/${encodeURIComponent(id)}/${action}`, "POST", { version });
    return confirmWrite(banner, { id, previousVersion: version, state: action === "publish" ? "PUBLISHED" : "PAUSED" });
  },
};
