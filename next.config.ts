import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.62'],
  async redirects() {
    return [
      { source: '/terms',        destination: '/legal/terms-of-service', permanent: true },
      { source: '/privacy',      destination: '/legal/privacy-policy',   permanent: true },
      // Guide application funnel removed in FA-1.06 (leads table archived, 0 rows).
      // The page had a canonical and is indexed — keep the URL alive with a 301.
      { source: '/guides/apply', destination: '/guides',                 permanent: true },
    ]
  },
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
