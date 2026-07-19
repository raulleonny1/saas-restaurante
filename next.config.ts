import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  // Prevent Turbopack from resolving `@/firebase` to root `firebase.json`
  turbopack: {
    resolveAlias: {
      "@/firebase": path.join(__dirname, "lib/firebase/index.ts"),
    },
  },
};

export default nextConfig;
