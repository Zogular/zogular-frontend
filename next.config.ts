import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return ["/sw.js", "/manifest.webmanifest"].map((source) => ({
      source,
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    }));
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
