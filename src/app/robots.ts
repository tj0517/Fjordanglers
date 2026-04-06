import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/account/',
          '/admin/',
          '/api/',
          '/auth/',
          '/invite/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/book/',
          '/plan-your-trip/',
        ],
      },
    ],
    sitemap: 'https://fjordanglers.com/sitemap.xml',
  }
}
