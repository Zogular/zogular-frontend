export function normalizePublicEmail(value: string | undefined, { disallowResend = false }: { disallowResend?: boolean } = {}): string {
  const email = value?.trim() ?? "";
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "";
  const domain = email.split("@").pop()?.toLowerCase() ?? "";
  if (disallowResend && (domain === "resend.dev" || domain.endsWith(".resend.dev"))) return "";
  return email;
}

export const BRAND = {
  name: "Zogular",
  wordmark: "ZOGULAR",
  slug: "zogular",
  tagline: "Zambia's Online Marketplace",
  description: "Connecting buyers and sellers across Zambia",
  supportEmail: normalizePublicEmail(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, { disallowResend: true }),
  careersEmail: normalizePublicEmail(process.env.NEXT_PUBLIC_CAREERS_EMAIL),
  adminEmail: normalizePublicEmail(process.env.NEXT_PUBLIC_ADMIN_EMAIL),
  domain: process.env.NEXT_PUBLIC_PUBLIC_DOMAIN ?? "zogular-frontend.vercel.app",
  assets: {
    wordmarkLight: "/brand/zogular-wordmark-light.png",
    wordmarkDark: "/brand/zogular-wordmark-dark.png",
    iconRoundedDark: "/brand/zogular-icon-rounded-dark.png",
    iconCircleLight: "/brand/zogular-icon-circle-light.png",
    iconLight: "/brand/zogular-icon-light.png",
    iconCircleDark: "/brand/zogular-icon-circle-dark.png",
    iconCircleOrange: "/brand/zogular-icon-circle-orange.png",
    iconCircleBlack: "/brand/zogular-icon-circle-black.png",
    favicon: "/brand/zogular-favicon-48.png?v=2",
    icon192: "/brand/zogular-icon-192.png",
    icon512: "/brand/zogular-icon-512.png",
  },
} as const;

export const BRAND_TITLE = `${BRAND.name} | ${BRAND.tagline}`;
export const BRAND_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://zogular-frontend.vercel.app";
