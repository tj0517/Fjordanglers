import type { NextConfig } from "next";

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

export default nextConfig;
