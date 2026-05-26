import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: "#f4fbf6",
    theme_color: "#009E49",
    icons: [
      {
        src: BRAND.assets.icon192,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: BRAND.assets.icon512,
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
