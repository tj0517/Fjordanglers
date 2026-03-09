import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Unsplash — demo/seed images
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      // Supabase Storage — guide photos, experience images
      // Wildcard covers any Supabase project (local + production)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
