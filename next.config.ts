import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.62'],
  images: {
    remotePatterns: [
      // Unsplash — demo/seed images
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Supabase Storage — raw objects
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      // Supabase Image Transformations — resized/converted via render API
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/render/image/public/**",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // Suppresses Sentry CLI output during build
  silent: !process.env.CI,

  // Route Sentry traffic through /monitoring to bypass ad-blockers
  tunnelRoute: "/monitoring",

  // Hide source maps from browser devtools
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },

  // Disable Sentry when DSN is not configured (safe local dev / CI without key)
  disableLogger: true,
});
