import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV !== "production",
});

const nextConfig: NextConfig = {
  // Phone loads the app from this machine's LAN address. Without this,
  // Next blocks /_next scripts and the page stays on Loading.
  allowedDevOrigins: ["192.168.1.6"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/hasaneyldrm/exercises-dataset/**",
      },
    ],
  },
};

export default withSerwist(nextConfig);
