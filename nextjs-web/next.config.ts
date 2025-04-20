import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // ADD HOSTNAME FOR IMAGES
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-c604c8e8374e4827ad2569364be2d13a.r2.dev",
        pathname: "/**", // allow any path
      },
    ],
  },
};

export default nextConfig;

// added by create cloudflare to enable calling `getCloudflareContext()` in `next dev`
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
