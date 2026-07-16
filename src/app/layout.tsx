import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";
import { QueryProvider } from "@/components/query-provider";
import { PwaRegistry } from "@/components/pwa/PwaRegistry";
import { BRAND, BRAND_SITE_URL, BRAND_TITLE } from "@/config/brand";

import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#009E49",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(BRAND_SITE_URL),
  title: BRAND_TITLE,
  description: BRAND.description,
  applicationName: BRAND.name,
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: BRAND_TITLE,
    description: BRAND.description,
    siteName: BRAND.name,
    images: [
      {
        url: BRAND.assets.wordmarkLight,
        width: 1341,
        height: 754,
        alt: BRAND.name,
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          {/* THE TOASTER IS NOW GLOBAL */}
          <Toaster position="top-center" richColors />
          <PwaRegistry />
          {children}
          <SpeedInsights />
          <Analytics />
        </QueryProvider>
      </body>
    </html>
  );
}
