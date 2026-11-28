import { z } from "zod";
import { apiClient, ApiError } from "@/services/api";
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
  id: z.uuid(),
  state: z.enum(["DRAFT", "PUBLISHED", "PAUSED"]),
  version: z.int().min(1).max(2_147_483_647),
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
const csrfDenialSchema = z.strictObject({
  status: z.literal("fail"),
  message: z.literal("Invalid CSRF token. Please refresh the page and try again."),
});
const canonicalActorSchema = z.uuid().refine((id) => id.length === 36 && id === id.toLowerCase());

export type HomepageBannerInput = z.infer<typeof bannerFields>;
export type AdminHomepageBanner = z.infer<typeof adminBannerSchema>;
export type HomepageBannerAsset = z.infer<typeof campaignAssetSchema>;
type CampaignWriteContext = Readonly<{ expectedActor: string; signal: AbortSignal }>;

export function isCanonicalCampaignActor(id: string): boolean {
  return canonicalActorSchema.safeParse(id).success;
}

export function isHomepageBannerCsrfDenial(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403 && csrfDenialSchema.safeParse(error.details).success;
}

async function writeBanner(path: string, method: "POST" | "PATCH", input: object, context: CampaignWriteContext) {
  context.signal.throwIfAborted();
  if (!isCanonicalCampaignActor(context.expectedActor)) {
    throw new ApiError("Refresh the page to verify your admin account before making another change.", 428);
  }
  const response = await apiClient<unknown>(path, {
    method,
    body: JSON.stringify(input),
    headers: { "X-Campaign-Expected-Actor": context.expectedActor },
    signal: context.signal,
    csrf: true,
    cache: "no-store",
    noAutoReplay: true,
    redirect: "error",
  });
  return mutationResponseSchema.parse(response).data.banner;
}

function confirmWrite(banner: AdminHomepageBanner, expected: {
  state: AdminHomepageBanner["state"];
  id?: string;
  version: number;
  input?: HomepageBannerInput;
}) {
  if (banner.state !== expected.state || (expected.id && banner.id !== expected.id)
    || banner.version !== expected.version
    || (expected.input && (
      banner.headline !== expected.input.headline || banner.description !== expected.input.description
      || banner.ctaLabel !== expected.input.ctaLabel || banner.destination !== expected.input.destination
      || banner.assetKey !== expected.input.assetKey
      || Date.parse(banner.startsAt) !== Date.parse(expected.input.startsAt)
      || Date.parse(banner.endsAt) !== Date.parse(expected.input.endsAt)
    ))) {
    throw new Error("Unexpected homepage banner mutation response.");
  }
  return banner;
}

export const adminContentApi = {
  async listHomepageBanners(signal?: AbortSignal) {
    const response = await apiClient<unknown>(endpoint, { cache: "no-store", signal });
    return listResponseSchema.parse(response).data;
  },
  async createHomepageBanner(input: HomepageBannerInput, context: CampaignWriteContext) {
    return confirmWrite(await writeBanner(endpoint, "POST", input, context), { state: "DRAFT", version: 1, input });
  },
  async updateHomepageBanner(id: string, version: number, input: HomepageBannerInput, context: CampaignWriteContext) {
    const banner = await writeBanner(`${endpoint}/${encodeURIComponent(id)}`, "PATCH", { ...input, version }, context);
    return confirmWrite(banner, { id, version: version + 1, state: "DRAFT", input });
  },
  async changeHomepageBannerState(id: string, version: number, action: "publish" | "pause", context: CampaignWriteContext) {
    const banner = await writeBanner(`${endpoint}/${encodeURIComponent(id)}/${action}`, "POST", { version }, context);
    return confirmWrite(banner, { id, version: version + 1, state: action === "publish" ? "PUBLISHED" : "PAUSED" });
  },
};
