export const BRAND = {
  name: "Zogular",
  wordmark: "ZOGULAR",
  slug: "zogular",
  tagline: "Zambia's Online Marketplace",
  description: "Connecting buyers and sellers across Zambia",
  supportEmail: "support@zogular.com",
  careersEmail: "careers@zogular.com",
  adminEmail: "admin@zogular.com",
  domain: "zogular.com",
  assets: {
    wordmarkLight: "/brand/zogular-wordmark-light.png",
    wordmarkDark: "/brand/zogular-wordmark-dark.png",
    iconRoundedDark: "/brand/zogular-icon-rounded-dark.png",
    iconCircleLight: "/brand/zogular-icon-circle-light.png",
    iconLight: "/brand/zogular-icon-light.png",
    iconCircleDark: "/brand/zogular-icon-circle-dark.png",
    iconCircleOrange: "/brand/zogular-icon-circle-orange.png",
    iconCircleBlack: "/brand/zogular-icon-circle-black.png",
    favicon: "/brand/zogular-icon-favicon.png",
    icon192: "/brand/zogular-icon-192.png",
    icon512: "/brand/zogular-icon-512.png",
  },
} as const;

export const BRAND_TITLE = `${BRAND.name} | ${BRAND.tagline}`;
export const BRAND_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zogular.com";
