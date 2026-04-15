import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-c604c8e8374e4827ad2569364be2d13a.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "aliasr.xyz",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
